import { isTerminalAgentProvider, type TerminalAgentProvider } from "@adadex/core";

export const AGENT_PROVIDER_STORAGE_KEY = "adadex.agentProvider";

export const AGENT_PROVIDER_OPTIONS: ReadonlyArray<{
  value: TerminalAgentProvider;
  label: string;
}> = [
  { value: "codex", label: "codex" },
  { value: "opencode", label: "opencode" },
  { value: "claude", label: "claude" },
];

export const readAgentProviderPreference = (): TerminalAgentProvider => {
  if (typeof window === "undefined") {
    return "codex";
  }

  try {
    const stored = window.localStorage.getItem(AGENT_PROVIDER_STORAGE_KEY);
    return isTerminalAgentProvider(stored) ? stored : "codex";
  } catch {
    return "codex";
  }
};

export const writeAgentProviderPreference = (provider: TerminalAgentProvider): void => {
  try {
    window.localStorage.setItem(AGENT_PROVIDER_STORAGE_KEY, provider);
  } catch {
    // Browser storage can be disabled.
  }
};
