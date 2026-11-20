import { isTerminalAgentProvider, type TerminalAgentProvider } from "@adadex/core";

export const AGENT_PROVIDER_STORAGE_KEY = "adadex.agentProvider";

// value at call sites) so the provider-switcher UI can be removed from
// ConsoleChromeHeader/ActionCards without touching this module again if a
// second provider is ever added.
export const AGENT_PROVIDER_OPTIONS: ReadonlyArray<{
  value: TerminalAgentProvider;
  label: string;
}> = [
  { value: "kiro", label: "kiro" },
  { value: "claude", label: "claude" },
  { value: "opencode", label: "opencode" },
];

export const readAgentProviderPreference = (): TerminalAgentProvider => {
  if (typeof window === "undefined") {
    return "claude";
  }

  try {
    const stored = window.localStorage.getItem(AGENT_PROVIDER_STORAGE_KEY);
    return isTerminalAgentProvider(stored) ? stored : "claude";
  } catch {
    return "claude";
  }
};

export const writeAgentProviderPreference = (provider: TerminalAgentProvider): void => {
  try {
    window.localStorage.setItem(AGENT_PROVIDER_STORAGE_KEY, provider);
  } catch {
    // Browser storage can be disabled.
  }
};
