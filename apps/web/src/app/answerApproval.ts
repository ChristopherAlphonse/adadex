import { asRecord, asString, type PermissionDecision } from "@adadex/core";

import { buildTerminalsUrl } from "../runtime/runtimeEndpoints";

/** Answers the permission prompt an agent is waiting on. Throws with the server's reason when it is refused. */
export const answerApproval = async (
  terminalId: string,
  decision: PermissionDecision,
): Promise<void> => {
  const response = await fetch(
    `${buildTerminalsUrl()}/${encodeURIComponent(terminalId)}/approval`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ decision }),
    },
  );

  if (!response.ok) {
    const failure = asRecord(await response.json().catch(() => null));

    throw new Error(asString(failure?.error) ?? `Unable to answer (${response.status})`);
  }
};
