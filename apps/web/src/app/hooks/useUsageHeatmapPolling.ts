import { buildUsageHeatmapUrl } from "../../runtime/runtimeEndpoints";
import { usePollingData } from "./usePollingData";

export type UsageSlice = {
  key: string;
  tokens: number;
};

export type UsageDayEntry = {
  date: string;
  totalTokens: number;
  projects: UsageSlice[];
  models: UsageSlice[];
  sessions: number;
};

export type UsageChartData = {
  days: UsageDayEntry[];
  projects: string[];
  models: string[];
};

const POLL_INTERVAL_MS = 120_000;

const normalize = (raw: unknown): UsageChartData | null => raw as UsageChartData | null;

const fallback = (): UsageChartData => ({ days: [], projects: [], models: [] });

export const useUsageHeatmapPolling = (options: { enabled: boolean }) => {
  const { data, isLoading, refresh } = usePollingData<UsageChartData>({
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
