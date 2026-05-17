export const CODEX_USAGE_SCAN_INTERVAL_MS = 600_000;
export const GITHUB_SUMMARY_SCAN_INTERVAL_MS = 60_000;
export const BACKEND_LIVENESS_SCAN_INTERVAL_MS = 120_000;
export const UI_STATE_SAVE_DEBOUNCE_MS = 250;
export const MIN_SIDEBAR_WIDTH = 240;
export const MAX_SIDEBAR_WIDTH = 520;

export const PRIMARY_NAV_ITEMS = [
  { index: 1, label: "Agents" },
  { index: 2, label: "Deck" },
  { index: 3, label: "Activity" },
  { index: 4, label: "Code Intel" },
  { index: 5, label: "Conversations" },
  { index: 6, label: "Prompts" },
  { index: 7, label: "Settings" },
] as const;

export const GITHUB_COMMIT_SERIES_LENGTH = 30;
export const GITHUB_SPARKLINE_WIDTH = 148;
export const GITHUB_SPARKLINE_HEIGHT = 36;
export const GITHUB_OVERVIEW_GRAPH_WIDTH = 640;
export const GITHUB_OVERVIEW_GRAPH_HEIGHT = 180;

export type PrimaryNavIndex = (typeof PRIMARY_NAV_ITEMS)[number]["index"];

export const PRIMARY_NAV_KEY_HINT = "1-7";

export const isPrimaryNavIndex = (value: number): value is PrimaryNavIndex =>
  PRIMARY_NAV_ITEMS.some((item) => item.index === value);
