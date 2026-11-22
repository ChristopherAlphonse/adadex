import { join } from "node:path";

import {
  COORDINATIONS_DIR_SEGMENT,
  type TerminalAgentProvider,
  WORKSPACE_RUNTIME_DIR,
} from "@adadex/core";

import {} from "../deck/readDeckCoordinations";
import {} from "../deck/swarmPrompts";
import { resolvePrompt } from "../prompts";
import { type CoordinationWorkspaceMode, type TerminalNameOrigin } from "../terminalRuntime";
import {} from "./routeHelpers";

export const shellSingleQuote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

export type DeckAgentProviderUpdate = { agentProvider?: TerminalAgentProvider | null };

export type DeckMascotUpdate = {
  color?: string;
  animation?: string;
  expression?: string;
  accessory?: string;
  hairColor?: string;
};

export type DeckTerminalCreateInput = {
  terminalId: string;
  coordinationId: string;
  coordinationName: string;
  workspaceMode: CoordinationWorkspaceMode;
  nameOrigin?: TerminalNameOrigin;
  autoRenamePromptContext?: string;
  worktreeId?: string;
  agentProvider?: TerminalAgentProvider;
  initialPrompt?: string;
  baseRef?: string;
};

export const buildSingleTodoWorkerPrompt = async ({
  promptsDir,
  workspaceCwd,
  coordinationId,
  coordinationName,
  todoItemText,
  terminalId,
  apiPort,
}: {
  promptsDir: string;
  workspaceCwd: string;
  coordinationId: string;
  coordinationName: string;
  todoItemText: string;
  terminalId: string;
  apiPort: string;
}) => {
  const coordinationContextPath = join(
    workspaceCwd,
    WORKSPACE_RUNTIME_DIR,
    COORDINATIONS_DIR_SEGMENT,
    coordinationId,
  );

  return await resolvePrompt(promptsDir, "swarm-worker", {
    coordinationName,
    coordinationId,
    coordinationContextPath,
    todoItemText,
    terminalId,
    apiPort,
    workspaceContextIntro:
      "You are working in the shared main workspace on the main branch, not in an isolated worktree.",
    workspaceGuidelines: [
      "- You must work in the main project directory. Do NOT create or use git worktrees for this task.",
      "- You are working in the shared main workspace. Keep edits narrow and focused on this one todo item.",
      "- Do NOT create commits. Leave your completed changes uncommitted in the main workspace.",
      "- Do NOT mark todo items done or rewrite coordination context files unless this specific todo item explicitly requires it.",
    ].join("\n"),
    commitGuidance:
      "- Do NOT commit. Leave your completed changes uncommitted in the shared workspace and report what changed.",
    definitionOfDoneCommitStep:
      "Changes are left uncommitted in the shared main workspace, ready for operator review.",
    workspaceReminder: "Do not commit. Do not use worktrees.",
    parentTerminalId: "",
    parentSection: "",
  });
};
