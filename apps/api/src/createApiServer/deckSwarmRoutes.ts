import { join } from "node:path";

import { COORDINATIONS_DIR_SEGMENT, asRecord, isNumber, WORKSPACE_RUNTIME_DIR } from "@adadex/core";

import {
  parseTodoProgress,
  readDeckCoordinations,
  readDeckVaultFile,
} from "../deck/readDeckCoordinations";
import {
  buildCompletionStrategySection,
  buildWorkerCommitGuidance,
  buildWorkerContextIntro,
  buildWorkerDefinitionOfDoneCommitStep,
  buildWorkerGuidelines,
  buildWorkerReminder,
  buildWorkerWorkspaceSection,
} from "../deck/swarmPrompts";
import { resolvePrompt } from "../prompts";
import { MAX_CHILDREN_PER_PARENT, RuntimeInputError } from "../terminalRuntime";
import { COORDINATION_WORKTREE_BRANCH_PREFIX } from "../terminalRuntime/constants";
import { type DeckTerminalCreateInput, shellSingleQuote } from "./deckRouteShared";
import type { ApiRouteHandler } from "./routeHelpers";
import { readJsonBodyOrWriteError, writeJson, writeMethodNotAllowed } from "./routeHelpers";
import { parseTerminalAgentProvider, parseTerminalWorkspaceMode } from "./terminalParsers";

const DECK_COORDINATION_SWARM_PATTERN = /^\/api\/deck\/coordinations\/([^/]+)\/swarm$/;

export const handleDeckOrchestrationSwarmRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { runtime, workspaceCwd, projectStateDir, promptsDir, getApiPort },
) => {
  const match = requestUrl.pathname.match(DECK_COORDINATION_SWARM_PATTERN);

  if (!match) return false;

  if (request.method !== "POST") {
    writeMethodNotAllowed(response, corsOrigin);

    return true;
  }

  // SAFETY: the route pattern's only capture group is non-optional, so a successful match always fills match[1].
  const coordinationId = decodeURIComponent(match[1] as string);

  const todoContent = readDeckVaultFile(workspaceCwd, coordinationId, "todo.md");

  if (todoContent === null) {
    writeJson(response, 404, { error: "Coordination or todo.md not found." }, corsOrigin);

    return true;
  }

  const todoResult = parseTodoProgress(todoContent);

  const incompleteItems = todoResult.items
    .map((item, index) => ({ ...item, index }))
    .filter((item) => !item.done);

  if (incompleteItems.length === 0) {
    writeJson(response, 400, { error: "No incomplete todo items found." }, corsOrigin);

    return true;
  }

  const bodyReadResult = await readJsonBodyOrWriteError(request, response, corsOrigin);

  if (!bodyReadResult.ok) return true;
  const body = asRecord(bodyReadResult.payload) ?? {};

  const agentProviderResult = parseTerminalAgentProvider(body);

  if (agentProviderResult.error) {
    writeJson(response, 400, { error: agentProviderResult.error }, corsOrigin);

    return true;
  }

  const workspaceModeResult = parseTerminalWorkspaceMode(body);

  if (workspaceModeResult.error) {
    writeJson(response, 400, { error: workspaceModeResult.error }, corsOrigin);

    return true;
  }

  const workerWorkspaceMode =
    body.workspaceMode === undefined ? "worktree" : workspaceModeResult.workspaceMode;

  let targetItems = incompleteItems;

  if (Array.isArray(body.todoItemIndices)) {
    const requestedIndices = new Set(body.todoItemIndices.filter((v): v is number => isNumber(v)));

    targetItems = incompleteItems.filter((item) => requestedIndices.has(item.index));

    if (targetItems.length === 0) {
      writeJson(
        response,
        400,
        { error: "None of the requested todo item indices are incomplete." },
        corsOrigin,
      );

      return true;
    }
  }

  if (targetItems.length > MAX_CHILDREN_PER_PARENT) {
    targetItems = targetItems.slice(0, MAX_CHILDREN_PER_PARENT);
  }

  const existingTerminals = runtime.listTerminalSnapshots();

  const existingSwarmIds = existingTerminals
    .filter((t) => t.terminalId.startsWith(`${coordinationId}-swarm-`))
    .map((t) => t.terminalId);

  if (existingSwarmIds.length > 0) {
    writeJson(
      response,
      409,
      { error: "A swarm is already active for this coordination.", existingSwarmIds },
      corsOrigin,
    );

    return true;
  }

  const coordinationWorktreeTerminal = existingTerminals.find(
    (t) => t.coordinationId === coordinationId && t.workspaceMode === "worktree",
  );

  const baseRef = coordinationWorktreeTerminal
    ? `${COORDINATION_WORKTREE_BRANCH_PREFIX}${coordinationId}`
    : "HEAD";

  const deckOrchestrations = readDeckCoordinations(workspaceCwd, projectStateDir);
  const deckEntry = deckOrchestrations.find((t) => t.coordinationId === coordinationId);
  const coordinationName = deckEntry?.displayName ?? coordinationId;

  const apiPort = getApiPort();
  const needsParent = targetItems.length > 1;
  const parentTerminalId = needsParent ? `${coordinationId}-swarm-parent` : null;

  const coordinationContextPath = join(
    workspaceCwd,
    WORKSPACE_RUNTIME_DIR,
    COORDINATIONS_DIR_SEGMENT,
    coordinationId,
  );

  const workers = targetItems.map((item) => ({
    terminalId: `${coordinationId}-swarm-${item.index}`,
    todoIndex: item.index,
    todoText: item.text,
  }));

  try {
    if (!needsParent) {
      const [item] = targetItems;
      const [worker] = workers;

      if (!item || !worker) {
        writeJson(response, 400, { error: "No incomplete todo items found." }, corsOrigin);

        return true;
      }

      const workerPrompt = await resolvePrompt(promptsDir, "swarm-worker", {
        coordinationName,
        coordinationId,
        coordinationContextPath,
        todoItemText: item.text,
        terminalId: worker.terminalId,
        apiPort,
        workspaceContextIntro: buildWorkerContextIntro(workerWorkspaceMode),
        workspaceGuidelines: buildWorkerGuidelines(workerWorkspaceMode, worker.terminalId),
        commitGuidance: buildWorkerCommitGuidance(workerWorkspaceMode),
        definitionOfDoneCommitStep: buildWorkerDefinitionOfDoneCommitStep(workerWorkspaceMode),
        workspaceReminder: buildWorkerReminder(workerWorkspaceMode),
        parentTerminalId: "",
        parentSection: "",
      });

      const workerInput: DeckTerminalCreateInput = {
        terminalId: worker.terminalId,
        coordinationId,
        coordinationName,
        nameOrigin: "generated",
        autoRenamePromptContext: item.text,
        workspaceMode: workerWorkspaceMode,
      };

      if (workerWorkspaceMode === "worktree") {
        workerInput.worktreeId = worker.terminalId;
        workerInput.baseRef = baseRef;
      }

      if (agentProviderResult.agentProvider) {
        workerInput.agentProvider = agentProviderResult.agentProvider;
      }

      if (workerPrompt) {
        workerInput.initialPrompt = workerPrompt;
      }

      runtime.createTerminal(workerInput);
    }

    if (needsParent && parentTerminalId) {
      const workerListing = workers
        .map((w) => `- \`${w.terminalId}\` — item #${w.todoIndex}: ${w.todoText}`)
        .join("\n");

      const workerSpawnCommands = targetItems
        .map((item) => {
          const workerTerminalId = `${coordinationId}-swarm-${item.index}`;

          const parentSection = [
            "## Communication",
            "",
            `Your parent coordinator is at terminal \`${parentTerminalId}\`.`,
            "When you complete your task, report back:",
            "```bash",
            `node bin/adadex channel send ${parentTerminalId} "DONE: ${item.text}" --from ${workerTerminalId}`,
            "```",
            "If you are blocked, ask for help:",
            "```bash",
            `node bin/adadex channel send ${parentTerminalId} "BLOCKED: <describe what you need>" --from ${workerTerminalId}`,
            "```",
          ].join("\n");

          const promptVariables = JSON.stringify({
            coordinationName,
            coordinationId,
            coordinationContextPath,
            todoItemText: item.text,
            terminalId: workerTerminalId,
            apiPort,
            workspaceContextIntro: buildWorkerContextIntro(workerWorkspaceMode),
            workspaceGuidelines: buildWorkerGuidelines(workerWorkspaceMode, workerTerminalId),
            commitGuidance: buildWorkerCommitGuidance(workerWorkspaceMode),
            definitionOfDoneCommitStep: buildWorkerDefinitionOfDoneCommitStep(workerWorkspaceMode),
            workspaceReminder: buildWorkerReminder(workerWorkspaceMode),
            parentTerminalId,
            parentSection,
          });

          const commandParts = [
            "node bin/adadex terminal create",
            `--terminal-id ${shellSingleQuote(workerTerminalId)}`,
            `--coordination-id ${shellSingleQuote(coordinationId)}`,
            `--parent-terminal-id ${shellSingleQuote(parentTerminalId)}`,
            `--workspace-mode ${workerWorkspaceMode}`,
            `--name ${shellSingleQuote(coordinationName)}`,
            "--name-origin generated",
            `--auto-rename-prompt-context ${shellSingleQuote(item.text)}`,
            "--prompt-template swarm-worker",
            `--prompt-variables ${shellSingleQuote(promptVariables)}`,
          ];

          if (workerWorkspaceMode === "worktree") {
            commandParts.splice(3, 0, `--worktree-id ${shellSingleQuote(workerTerminalId)}`);
          }

          const command = commandParts.join(" ");

          return `- \`${workerTerminalId}\`:\n  \`\`\`bash\n  ${command}\n  \`\`\``;
        })
        .join("\n");

      const parentBaseBranch =
        workerWorkspaceMode === "worktree" ? (baseRef === "HEAD" ? "main" : baseRef) : "main";

      const parentPrompt = await resolvePrompt(promptsDir, "swarm-parent", {
        coordinationName,
        coordinationId,
        workerCount: String(workers.length),
        maxChildrenPerParent: String(MAX_CHILDREN_PER_PARENT),
        workerListing,
        workerWorkspaceSection: buildWorkerWorkspaceSection(workerWorkspaceMode, workers),
        workerSpawnCommands,
        completionStrategySection: buildCompletionStrategySection(
          workerWorkspaceMode,
          parentBaseBranch,
          coordinationId,
          workers.length,
        ),
        baseBranch: parentBaseBranch,
        terminalId: parentTerminalId,
        apiPort,
      });

      const parentInput: DeckTerminalCreateInput = {
        terminalId: parentTerminalId,
        coordinationId,
        coordinationName: `${coordinationName} (coordinator)`,
        workspaceMode: "shared",
      };

      if (agentProviderResult.agentProvider) {
        parentInput.agentProvider = agentProviderResult.agentProvider;
      }

      if (parentPrompt) {
        parentInput.initialPrompt = parentPrompt;
      }

      runtime.createTerminal(parentInput);
    }
  } catch (error) {
    if (error instanceof RuntimeInputError) {
      writeJson(response, 400, { error: error.message }, corsOrigin);

      return true;
    }

    throw error;
  }

  writeJson(response, 201, { coordinationId, parentTerminalId, workers }, corsOrigin);

  return true;
};
