/** Token usage heatmap: legacy integration removed; returns empty series until Codex session export is wired. */

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

export type UsageChartResponse = {
  days: UsageDayEntry[];
  projects: string[];
  models: string[];
};

export const scanUsageHeatmap = async (
  _scope: "all" | "project",
  _workspaceCwd: string,
): Promise<UsageChartResponse> => ({
  days: [],
  projects: [],
  models: [],
});
