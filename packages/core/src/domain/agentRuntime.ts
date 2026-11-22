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

const SAFE_AGENT_FLAG_VALUE = /^[A-Za-z0-9._:/-]{1,80}$/;

/** A model or effort value that is safe to type after a flag in a shell: letters, digits and . _ : / - only. */
export const isSafeAgentFlagValue = (value: unknown): value is string =>
  typeof value === "string" && SAFE_AGENT_FLAG_VALUE.test(value);

export type AgentLaunchOptions = { model?: string | undefined; effort?: string | undefined };

/**
 * The command typed into a new terminal. Only Claude Code takes `--model` and `--effort` (checked against
 * `claude --help`); the other agents launch bare, because their launch flags differ and were not verified.
 * Values that are not safe flag values are left out.
 */
export const buildAgentLaunchCommand = (
  provider: TerminalAgentProvider,
  baseCommand: string,
  options: AgentLaunchOptions = {},
): string => {
  if (provider !== "claude") {
    return baseCommand;
  }

  return [
    baseCommand,
    ...(isSafeAgentFlagValue(options.model) ? ["--model", options.model] : []),
    ...(isSafeAgentFlagValue(options.effort) ? ["--effort", options.effort] : []),
  ].join(" ");
};
