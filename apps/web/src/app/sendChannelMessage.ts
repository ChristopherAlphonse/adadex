import { asRecord, asString } from "@adadex/core";

import { buildChannelMessagesUrl } from "../runtime/runtimeEndpoints";

/** Sends a message from the operator to one agent session. Throws with the server's reason when refused. */
export const sendChannelMessage = async (sessionId: string, content: string): Promise<void> => {
  const response = await fetch(buildChannelMessagesUrl(sessionId), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ fromTerminalId: "operator", content }),
  });

  if (!response.ok) {
    const failure = asRecord(await response.json().catch(() => null));

    throw new Error(asString(failure?.error) ?? `Unable to send the message (${response.status})`);
  }
};
