import { asRecord, asString } from "@adadex/core";

import { buildTerminalActionUrl, buildTerminalLaunchOptionsUrl } from "./runtimeEndpoints";

export type TerminalLaunchOptionsPatch = {
  agentModel?: string;
  agentEffort?: string;
};

const readFailureReason = async (response: Response, fallback: string): Promise<string> => {
  const failure = asRecord(await response.json().catch(() => null));

  return asString(failure?.error) ?? fallback;
};

export const stopTerminal = async (terminalId: string): Promise<void> => {
  const response = await fetch(buildTerminalActionUrl(terminalId, "stop"), {
    method: "POST",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(await readFailureReason(response, `Unable to stop agent (${response.status})`));
  }
};

export const updateTerminalLaunchOptions = async (
  terminalId: string,
  patch: TerminalLaunchOptionsPatch,
): Promise<void> => {
  const response = await fetch(buildTerminalLaunchOptionsUrl(terminalId), {
    method: "PATCH",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });

  if (!response.ok) {
    throw new Error(
      await readFailureReason(response, `Unable to save launch options (${response.status})`),
    );
  }
};
