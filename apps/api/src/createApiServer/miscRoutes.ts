import type { WorkspaceSetupStepId } from "@adadex/core";

import {
  deleteUserPrompt,
  listAllPrompts,
  readPromptFromDirs,
  resolvePrompt,
  writeUserPrompt,
} from "../prompts";
import { markSetupStepVerified } from "../setupState";
import {
  ensureWorkspaceGitignore,
  initializeWorkspaceFiles,
  readWorkspaceSetupSnapshot,
} from "../setupStatus";
import type { ApiRouteHandler } from "./routeHelpers";
import {
  readJsonBodyOrWriteError,
  writeJson,
  writeMethodNotAllowed,
  writeNoContent,
} from "./routeHelpers";
import { parseUiStatePatch } from "./uiStateParsers";

const WORKSPACE_SETUP_PATH = "/api/setup";
const WORKSPACE_SETUP_STEP_PATH_PATTERN = /^\/api\/setup\/steps\/([^/]+)$/;

const isWorkspaceSetupStepId = (value: string): value is WorkspaceSetupStepId =>
  value === "initialize-workspace" ||
  value === "ensure-gitignore" ||
  value === "check-codex" ||
  value === "check-git" ||
  value === "check-curl" ||
  value === "create-coordinations";

export const handleWorkspaceSetupRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { workspaceCwd, projectStateDir },
) => {
  if (requestUrl.pathname === WORKSPACE_SETUP_PATH) {
    if (request.method !== "GET") {
      writeMethodNotAllowed(response, corsOrigin);
      return true;
    }

    writeJson(response, 200, readWorkspaceSetupSnapshot(workspaceCwd, projectStateDir), corsOrigin);
    return true;
  }

  const match = requestUrl.pathname.match(WORKSPACE_SETUP_STEP_PATH_PATTERN);
  if (!match) {
    return false;
  }

  const stepId = decodeURIComponent(match[1] ?? "");
  if (!isWorkspaceSetupStepId(stepId)) {
    writeJson(response, 404, { error: "Setup step not found." }, corsOrigin);
    return true;
  }

  if (request.method !== "POST") {
    writeMethodNotAllowed(response, corsOrigin);
    return true;
  }

  if (stepId === "initialize-workspace") {
    initializeWorkspaceFiles(workspaceCwd, projectStateDir);
  } else if (stepId === "ensure-gitignore") {
    ensureWorkspaceGitignore(workspaceCwd);
  } else if (stepId === "check-codex" || stepId === "check-git" || stepId === "check-curl") {
    markSetupStepVerified(projectStateDir, stepId);
  }

  writeJson(response, 200, readWorkspaceSetupSnapshot(workspaceCwd, projectStateDir), corsOrigin);
  return true;
};

export const handleUiStateRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { runtime },
) => {
  if (requestUrl.pathname !== "/api/ui-state") {
    return false;
  }

  if (request.method === "GET") {
    const payload = runtime.readUiState();
    writeJson(response, 200, payload, corsOrigin);
    return true;
  }

  if (request.method !== "PATCH") {
    writeMethodNotAllowed(response, corsOrigin);
    return true;
  }

  const bodyReadResult = await readJsonBodyOrWriteError(request, response, corsOrigin);
  if (!bodyReadResult.ok) {
    return true;
  }

  const uiStatePatch = parseUiStatePatch(bodyReadResult.payload);
  if (uiStatePatch.error || !uiStatePatch.patch) {
    writeJson(
      response,
      400,
      { error: uiStatePatch.error ?? "Invalid UI state patch." },
      corsOrigin,
    );
    return true;
  }

  const payload = runtime.patchUiState(uiStatePatch.patch);
  writeJson(response, 200, payload, corsOrigin);
  return true;
};

const HOOK_PATH_PATTERN =
  /^\/api\/hooks\/(session-start|user-prompt-submit|pre-tool-use|notification|stop)$/;

export const handleHookRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { runtime, readCodexUsageSnapshot },
) => {
  const match = requestUrl.pathname.match(HOOK_PATH_PATTERN);
  if (!match) {
    return false;
  }

  if (request.method !== "POST") {
    writeMethodNotAllowed(response, corsOrigin);
    return true;
  }

  const body = await readJsonBodyOrWriteError(request, response, corsOrigin);
  if (!body.ok) {
    return true;
  }

  const hookName = match[1] ?? "";
  // HTTP hooks pass the session ID via header; command hooks via query param.
  const headerKeys = ["x-adadex-session", "x-octogent-session"] as const;
  let hookSessionId: string | undefined;
  for (const key of headerKeys) {
    const value = request.headers[key];
    if (typeof value === "string" && value.length > 0) {
      hookSessionId = value;
      break;
    }
  }
  hookSessionId =
    hookSessionId ??
    requestUrl.searchParams.get("adadex_session") ??
    requestUrl.searchParams.get("octogent_session") ??
    undefined;
  const result = runtime.handleHook(hookName, body.payload, hookSessionId);

  if (hookName === "session-start" || hookName === "stop") {
    void readCodexUsageSnapshot();
  }

  writeJson(response, 200, result, corsOrigin);
  return true;
};

const PROMPT_ITEM_PATH_PATTERN = /^\/api\/prompts\/([^/]+)$/;

export const handlePromptsCollectionRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { promptsDir, userPromptsDir },
) => {
  if (requestUrl.pathname !== "/api/prompts") {
    return false;
  }

  if (request.method === "GET") {
    const prompts = await listAllPrompts(promptsDir, userPromptsDir);
    writeJson(response, 200, { prompts }, corsOrigin);
    return true;
  }

  if (request.method === "POST") {
    const bodyResult = await readJsonBodyOrWriteError(request, response, corsOrigin);
    if (!bodyResult.ok) return true;

    const body = bodyResult.payload as Record<string, unknown> | null;
    const name = body && typeof body.name === "string" ? body.name.trim() : "";
    const content = body && typeof body.content === "string" ? body.content : "";

    if (name.length === 0) {
      writeJson(response, 400, { error: "Prompt name is required." }, corsOrigin);
      return true;
    }

    const ok = await writeUserPrompt(userPromptsDir, name, content);
    if (!ok) {
      writeJson(response, 400, { error: "Invalid prompt name." }, corsOrigin);
      return true;
    }

    writeJson(response, 201, { name, source: "user" }, corsOrigin);
    return true;
  }

  writeMethodNotAllowed(response, corsOrigin);
  return true;
};

export const handlePromptItemRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { promptsDir, userPromptsDir },
) => {
  const match = requestUrl.pathname.match(PROMPT_ITEM_PATH_PATTERN);
  if (!match) return false;

  const name = decodeURIComponent(match[1] as string);

  if (request.method === "GET") {
    // Resolve variables from query params (e.g. ?coordinationId=sandbox).
    const variables: Record<string, string> = {};
    for (const [key, value] of requestUrl.searchParams.entries()) {
      variables[key] = value;
    }

    const hasVariables = Object.keys(variables).length > 0;
    if (hasVariables) {
      const resolved = await resolvePrompt(promptsDir, name, variables);
      if (resolved === undefined) {
        writeJson(response, 404, { error: "Prompt template not found" }, corsOrigin);
        return true;
      }
      writeJson(response, 200, { name, prompt: resolved }, corsOrigin);
    } else {
      const result = await readPromptFromDirs(promptsDir, userPromptsDir, name);
      if (result === undefined) {
        writeJson(response, 404, { error: "Prompt template not found" }, corsOrigin);
        return true;
      }
      writeJson(response, 200, result, corsOrigin);
    }
    return true;
  }

  if (request.method === "PUT") {
    const bodyResult = await readJsonBodyOrWriteError(request, response, corsOrigin);
    if (!bodyResult.ok) return true;

    const body = bodyResult.payload as Record<string, unknown> | null;
    const content = body && typeof body.content === "string" ? body.content : "";

    const ok = await writeUserPrompt(userPromptsDir, name, content);
    if (!ok) {
      writeJson(response, 400, { error: "Invalid prompt name." }, corsOrigin);
      return true;
    }
    writeJson(response, 200, { name, source: "user", content }, corsOrigin);
    return true;
  }

  if (request.method === "DELETE") {
    const ok = await deleteUserPrompt(userPromptsDir, name);
    if (!ok) {
      writeJson(response, 404, { error: "Prompt not found or cannot be deleted." }, corsOrigin);
      return true;
    }
    writeNoContent(response, 204, corsOrigin);
    return true;
  }

  writeMethodNotAllowed(response, corsOrigin);
  return true;
};

// ─── Channel routes ───────────────────────────────────────────────────────

const CHANNEL_MESSAGES_PATH_PATTERN = /^\/api\/channels\/([^/]+)\/messages$/;

export const handleChannelMessagesRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { runtime },
) => {
  const match = requestUrl.pathname.match(CHANNEL_MESSAGES_PATH_PATTERN);
  if (!match) {
    return false;
  }

  const terminalId = decodeURIComponent(match[1] ?? "");

  if (request.method === "GET") {
    const messages = runtime.listChannelMessages(terminalId);
    writeJson(response, 200, { terminalId, messages }, corsOrigin);
    return true;
  }

  if (request.method !== "POST") {
    writeMethodNotAllowed(response, corsOrigin);
    return true;
  }

  const bodyReadResult = await readJsonBodyOrWriteError(request, response, corsOrigin);
  if (!bodyReadResult.ok) {
    return true;
  }

  const body = bodyReadResult.payload as Record<string, unknown> | null;
  const fromTerminalId =
    body && typeof body.fromTerminalId === "string" ? body.fromTerminalId.trim() : "";
  const content = body && typeof body.content === "string" ? body.content.trim() : "";

  if (content.length === 0) {
    writeJson(response, 400, { error: "Message content cannot be empty." }, corsOrigin);
    return true;
  }

  const message = runtime.sendChannelMessage(terminalId, fromTerminalId, content);
  if (!message) {
    writeJson(response, 404, { error: "Target terminal not found." }, corsOrigin);
    return true;
  }

  writeJson(response, 201, message, corsOrigin);
  return true;
};
