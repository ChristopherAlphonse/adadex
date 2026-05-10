import { useRef } from "react";
import { buildCodexUsageUrl } from "../../runtime/runtimeEndpoints";
import { CODEX_USAGE_SCAN_INTERVAL_MS } from "../constants";
import { normalizeCodexUsageSnapshot } from "../usageNormalizers";
import { usePollingData } from "./usePollingData";
const fallback = () => ({
    status: "error",
    source: "none",
    fetchedAt: new Date().toISOString(),
});
export const useCodexUsagePolling = () => {
    const lastOkRef = useRef(null);
    const normalize = (raw) => {
        const snapshot = normalizeCodexUsageSnapshot(raw);
        if (snapshot?.status === "ok") {
            lastOkRef.current = snapshot;
            return snapshot;
        }
        return lastOkRef.current ?? snapshot;
    };
    const { data, isLoading, refresh } = usePollingData({
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
