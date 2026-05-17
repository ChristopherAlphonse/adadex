import { type TerminalAgentProvider } from "@adadex/core";
import { useCallback, useState } from "react";

import {
  readAgentProviderPreference,
  writeAgentProviderPreference,
} from "../agentProviders";

type UseAgentProviderPreferenceResult = {
  agentProvider: TerminalAgentProvider;
  setAgentProvider: (provider: TerminalAgentProvider) => void;
};

export const useAgentProviderPreference = (): UseAgentProviderPreferenceResult => {
  const [agentProvider, setAgentProviderState] = useState<TerminalAgentProvider>(
    readAgentProviderPreference,
  );

  const setAgentProvider = useCallback((provider: TerminalAgentProvider) => {
    writeAgentProviderPreference(provider);
    setAgentProviderState(provider);
  }, []);

  return { agentProvider, setAgentProvider };
};
