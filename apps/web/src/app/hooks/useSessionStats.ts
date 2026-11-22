import { type UsageSummary, asNumber, asRecord } from "@adadex/core";
import { useEffect, useState } from "react";

import { buildConversationStatsUrl } from "../../runtime/runtimeEndpoints";

const REFRESH_MS = 5000;

const isUsageSummary = (value: unknown): value is UsageSummary => {
  const record = asRecord(value);

  return (
    record !== null &&
    asNumber(record.requestCount) !== null &&
    asNumber(record.contextTokens) !== null &&
    asNumber(record.totalOutput) !== null
  );
};

/** Token use of one session, read from its transcript on the server. Null while unknown or not yet recorded. */
export const useSessionStats = (sessionId: string | null) => {
  const [stats, setStats] = useState<{ sessionId: string; summary: UsageSummary } | null>(null);

  useEffect(() => {
    if (!sessionId) {
      return undefined;
    }

    const controller = new AbortController();

    const load = async () => {
      try {
        const response = await fetch(buildConversationStatsUrl(sessionId), {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!response.ok) {
          setStats(null);

          return;
        }

        const body: unknown = await response.json();

        if (isUsageSummary(body)) {
          setStats({ sessionId, summary: body });
        }
      } catch {}
    };

    void load();

    const timer = setInterval(() => {
      void load();
    }, REFRESH_MS);

    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [sessionId]);

  return stats && stats.sessionId === sessionId ? stats.summary : null;
};
