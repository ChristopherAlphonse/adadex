import { type TranscriptMessage, asRecord, asString } from "@adadex/core";
import { useEffect, useState } from "react";

import { buildConversationChatUrl } from "../../runtime/runtimeEndpoints";

const isTranscriptMessage = (value: unknown): value is TranscriptMessage => {
  const record = asRecord(value);

  return record !== null && asString(record.id) !== null && Array.isArray(record.blocks);
};

/** Structured chat for a session; refetches when `version` (e.g. last event time) changes. Null when unavailable. */
export const useConversationChat = (sessionId: string | null, version: string | null) => {
  const [chat, setChat] = useState<{ sessionId: string; messages: TranscriptMessage[] } | null>(
    null,
  );

  useEffect(() => {
    if (!sessionId) {
      return undefined;
    }

    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch(buildConversationChatUrl(sessionId), {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!response.ok) {
          setChat(null);

          return;
        }

        const payload = asRecord(await response.json());

        if (payload && Array.isArray(payload.messages)) {
          setChat({ sessionId, messages: payload.messages.filter(isTranscriptMessage) });
        }
      } catch {}
    })();

    return () => {
      controller.abort();
    };
  }, [sessionId, version]);

  return chat && chat.sessionId === sessionId ? chat.messages : null;
};
