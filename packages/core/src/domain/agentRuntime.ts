export type AgentRuntimeState =
  | "idle"
  | "processing"
  | "waiting_for_permission"
  | "waiting_for_user";

export const isAgentRuntimeState = (value: unknown): value is AgentRuntimeState =>
  value === "idle" ||
  value === "processing" ||
  value === "waiting_for_permission" ||
  value === "waiting_for_user";

/** The agent CLIs Adadex can launch in a terminal. */
export type TerminalAgentProvider = "claude" | "opencode" | "kiro";

export const TERMINAL_AGENT_PROVIDERS: TerminalAgentProvider[] = ["claude", "opencode", "kiro"];

export const isTerminalAgentProvider = (value: unknown): value is TerminalAgentProvider =>
  value === "claude" || value === "opencode" || value === "kiro";
