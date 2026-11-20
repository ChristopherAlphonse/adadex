import { asNumber, asRecord, asString, isString, type ParsedValue } from "@adadex/core";

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

const normalizeSlice = (value: ParsedValue): UsageSlice | null => {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  const key = asString(record.key);
  const tokens = asNumber(record.tokens);

  if (key === null || tokens === null) {
    return null;
  }

  return { key, tokens };
};

const normalizeSlices = (value: ParsedValue): UsageSlice[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeSlice(item))
    .filter((item): item is UsageSlice => item !== null);
};

const normalizeStrings = (value: ParsedValue): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => isString(item));
};

const normalizeDayEntry = (value: ParsedValue): UsageDayEntry | null => {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  const date = asString(record.date);
  const totalTokens = asNumber(record.totalTokens);
  const sessions = asNumber(record.sessions);

  if (date === null || totalTokens === null || sessions === null) {
    return null;
  }

  return {
    date,
    totalTokens,
    projects: normalizeSlices(record.projects),
    models: normalizeSlices(record.models),
    sessions,
  };
};

const normalize = (raw: ParsedValue): UsageChartData | null => {
  const record = asRecord(raw);

  if (!record || !Array.isArray(record.days)) {
    return null;
  }

  return {
    days: record.days
      .map((day) => normalizeDayEntry(day))
      .filter((day): day is UsageDayEntry => day !== null),
    projects: normalizeStrings(record.projects),
    models: normalizeStrings(record.models),
  };
};

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
