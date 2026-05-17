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

export type TerminalAgentProvider = "codex" | "opencode" | "claude";

export const TERMINAL_AGENT_PROVIDERS: TerminalAgentProvider[] = ["codex", "opencode", "claude"];

export const isTerminalAgentProvider = (value: unknown): value is TerminalAgentProvider =>
  typeof value === "string" && TERMINAL_AGENT_PROVIDERS.includes(value as TerminalAgentProvider);

export type AgentProviderModel = {
  id: string;
  label: string;
};

export const AGENT_PROVIDER_MODELS: Record<TerminalAgentProvider, AgentProviderModel[]> = {
  codex: [
    { id: "o4-mini", label: "o4-mini (default)" },
    { id: "o3", label: "o3" },
    { id: "o3-mini", label: "o3-mini" },
    { id: "gpt-4.1", label: "GPT-4.1" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "gpt-4o-mini", label: "GPT-4o mini" },
  ],
  claude: [
    { id: "claude-opus-4-7", label: "Claude Opus 4.7" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  ],
  opencode: [
    { id: "anthropic/claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { id: "anthropic/claude-opus-4-7", label: "Claude Opus 4.7" },
    { id: "openai/gpt-4o", label: "GPT-4o" },
    { id: "openai/o4-mini", label: "o4-mini" },
  ],
};
