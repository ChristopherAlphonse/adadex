import { isTerminalAgentProvider, type TerminalAgentProvider } from "@adadex/core";

export const AGENT_PROVIDER_STORAGE_KEY = "adadex.agentProvider";

// Only "kiro" is supported today. Kept as an array (rather than inlining the
// value at call sites) so the provider-switcher UI can be removed from
// ConsoleChromeHeader/ActionCards without touching this module again if a
// second provider is ever added.
export const AGENT_PROVIDER_OPTIONS: ReadonlyArray<{
  value: TerminalAgentProvider;
  label: string;
}> = [{ value: "kiro", label: "kiro" }];

export const readAgentProviderPreference = (): TerminalAgentProvider => {
  if (typeof window === "undefined") {
    return "kiro";
  }

  try {
    const stored = window.localStorage.getItem(AGENT_PROVIDER_STORAGE_KEY);
    return isTerminalAgentProvider(stored) ? stored : "kiro";
  } catch {
    return "kiro";
  }
};

export const writeAgentProviderPreference = (provider: TerminalAgentProvider): void => {
  try {
    window.localStorage.setItem(AGENT_PROVIDER_STORAGE_KEY, provider);
  } catch {
    // Browser storage can be disabled.
  }
};
