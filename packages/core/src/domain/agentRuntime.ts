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

// Kiro CLI is the only supported agent provider. The type stays a union (rather
// than a bare string literal) so callers that persist/validate it keep doing so
// explicitly, and so a future provider can be added without reshaping callers.
export type TerminalAgentProvider = "kiro";

export const TERMINAL_AGENT_PROVIDERS: TerminalAgentProvider[] = ["kiro"];

export const isTerminalAgentProvider = (value: unknown): value is TerminalAgentProvider =>
  value === "kiro";
