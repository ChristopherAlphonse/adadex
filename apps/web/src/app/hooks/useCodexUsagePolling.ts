import { useRef } from "react";

import { buildCodexUsageUrl } from "../../runtime/runtimeEndpoints";
import { CODEX_USAGE_SCAN_INTERVAL_MS } from "../constants";
import type { CodexUsageSnapshot } from "../types";
import { normalizeCodexUsageSnapshot } from "../usageNormalizers";
import { usePollingData } from "./usePollingData";

const fallback = (): CodexUsageSnapshot => ({
  status: "error",
  source: "none",
  fetchedAt: new Date().toISOString(),
});

export const useCodexUsagePolling = () => {
  const lastOkRef = useRef<CodexUsageSnapshot | null>(null);

  const normalize = (raw: unknown): CodexUsageSnapshot | null => {
    const snapshot = normalizeCodexUsageSnapshot(raw);
    if (snapshot?.status === "ok") {
      lastOkRef.current = snapshot;
      return snapshot;
    }
    return lastOkRef.current ?? snapshot;
  };

  const { data, isLoading, refresh } = usePollingData<CodexUsageSnapshot>({
    fetchUrl: buildCodexUsageUrl(),
    intervalMs: CODEX_USAGE_SCAN_INTERVAL_MS,
    normalize,
    fallback,
  });

  return {
    codexUsageSnapshot: data,
    isRefreshingCodexUsage: isLoading,
    refreshCodexUsage: refresh,
  };
};
