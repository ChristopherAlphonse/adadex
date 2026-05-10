import { buildUsageHeatmapUrl } from "../../runtime/runtimeEndpoints";
import { usePollingData } from "./usePollingData";
const POLL_INTERVAL_MS = 120_000;
const normalize = (raw) => raw;
const fallback = () => ({ days: [], projects: [], models: [] });
export const useUsageHeatmapPolling = (options) => {
    const { data, isLoading, refresh } = usePollingData({
        fetchUrl: buildUsageHeatmapUrl("all"),
        intervalMs: POLL_INTERVAL_MS,
        normalize,
        fallback,
        enabled: options.enabled,
    });
    return {
        heatmapData: data,
        isLoadingHeatmap: isLoading,
        refreshHeatmap: refresh,
    };
};
