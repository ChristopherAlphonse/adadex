import { TERMINAL_AGENT_PROVIDERS, isObjectValue, isString, type ParsedRecord } from "@adadex/core";

import {
  type CoordinationWorkspaceMode,
  isTerminalAgentProvider,
  type TerminalAgentProvider,
  type TerminalNameOrigin,
} from "../terminalRuntime";
import type { JsonRequestPayload } from "./requestParsers";

type TerminalNameParseResult = {
  provided: boolean;
  name: string | undefined;
  error: string | null;
};

type TerminalWorkspaceModeParseResult = {
  workspaceMode: CoordinationWorkspaceMode;
  error: string | null;
};

type TerminalAgentProviderParseResult = {
  agentProvider: TerminalAgentProvider | undefined;
  error: string | null;
};

type TerminalNameOriginParseResult = {
  nameOrigin: TerminalNameOrigin | undefined;
  error: string | null;
};

const isTerminalNameOrigin = (value: unknown): value is TerminalNameOrigin =>
  value === "generated" || value === "user" || value === "prompt";

export const parseTerminalName = (payload: JsonRequestPayload): TerminalNameParseResult => {
  if (payload === null || payload === undefined) {
    return {
      provided: false,
      name: undefined,
      error: null,
    };
  }

  if (!isObjectValue(payload)) {
    return {
      provided: true,
      name: undefined,
      error: "Expected a JSON object body.",
    };
  }

  // SAFETY: the parse boundary produced ParsedValue members; missing keys read as undefined.
  const rawName = (payload as ParsedRecord).name;

  if (rawName === undefined) {
    return {
      provided: false,
      name: undefined,
      error: null,
    };
  }

  if (!isString(rawName)) {
    return {
      provided: true,
      name: undefined,
      error: "Terminal name must be a string.",
    };
  }

  const trimmed = rawName.trim();

  if (trimmed.length === 0) {
    return {
      provided: true,
      name: undefined,
      error: "Terminal name cannot be empty.",
    };
  }

  return {
    provided: true,
    name: trimmed,
    error: null,
  };
};

export const parseTerminalWorkspaceMode = (
  payload: JsonRequestPayload,
): TerminalWorkspaceModeParseResult => {
  if (payload === null || payload === undefined) {
    return {
      workspaceMode: "shared",
      error: null,
    };
  }

  if (!isObjectValue(payload)) {
    return {
      workspaceMode: "shared",
      error: "Expected a JSON object body.",
    };
  }

  // SAFETY: the parse boundary produced ParsedValue members; missing keys read as undefined.
  const rawWorkspaceMode = (payload as ParsedRecord).workspaceMode;

  if (rawWorkspaceMode === undefined) {
    return {
      workspaceMode: "shared",
      error: null,
    };
  }

  if (rawWorkspaceMode !== "shared" && rawWorkspaceMode !== "worktree") {
    return {
      workspaceMode: "shared",
      error: "Terminal workspace mode must be either 'shared' or 'worktree'.",
    };
  }

  return {
    workspaceMode: rawWorkspaceMode,
    error: null,
  };
};

export const parseTerminalAgentProvider = (
  payload: JsonRequestPayload,
): TerminalAgentProviderParseResult => {
  if (payload === null || payload === undefined) {
    return {
      agentProvider: undefined,
      error: null,
    };
  }

  if (!isObjectValue(payload)) {
    return {
      agentProvider: undefined,
      error: "Expected a JSON object body.",
    };
  }

  // SAFETY: the parse boundary produced ParsedValue members; missing keys read as undefined.
  const rawAgentProvider = (payload as ParsedRecord).agentProvider;

  if (rawAgentProvider === undefined) {
    return {
      agentProvider: undefined,
      error: null,
    };
  }

  if (!isTerminalAgentProvider(rawAgentProvider)) {
    return {
      agentProvider: undefined,
      error: `Terminal agent provider must be one of: ${TERMINAL_AGENT_PROVIDERS.join(", ")}.`,
    };
  }

  return {
    agentProvider: rawAgentProvider,
    error: null,
  };
};

export const parseTerminalNameOrigin = (
  payload: JsonRequestPayload,
): TerminalNameOriginParseResult => {
  if (payload === null || payload === undefined) {
    return {
      nameOrigin: undefined,
      error: null,
    };
  }

  if (!isObjectValue(payload)) {
    return {
      nameOrigin: undefined,
      error: "Expected a JSON object body.",
    };
  }

  // SAFETY: the parse boundary produced ParsedValue members; missing keys read as undefined.
  const rawNameOrigin = (payload as ParsedRecord).nameOrigin;

  if (rawNameOrigin === undefined) {
    return {
      nameOrigin: undefined,
      error: null,
    };
  }

  if (!isTerminalNameOrigin(rawNameOrigin)) {
    return {
      nameOrigin: undefined,
      error: "Terminal name origin must be 'generated', 'user', or 'prompt'.",
    };
  }

  return {
    nameOrigin: rawNameOrigin,
    error: null,
  };
};
