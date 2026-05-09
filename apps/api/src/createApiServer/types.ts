import type { CodexUsageSnapshot } from "../codexUsage";
import type { GitHubRepoSummarySnapshot } from "../githubRepoSummary";
import type { MonitorService } from "../monitor";
import type { GitClient } from "../terminalRuntime";
import type { UsageChartResponse } from "../usageHeatmapScanner";

export type CreateApiServerOptions = {
  workspaceCwd?: string | undefined;
  projectStateDir?: string | undefined;
  promptsDir?: string | undefined;
  webDistDir?: string | undefined;
  apiBaseUrl?: string | undefined;
  gitClient?: GitClient;
  readCodexUsageSnapshot?: () => Promise<CodexUsageSnapshot>;
  readGithubRepoSummary?: () => Promise<GitHubRepoSummarySnapshot>;
  scanUsageHeatmap?: (scope: "all" | "project") => Promise<UsageChartResponse>;
  monitorService?: MonitorService;
  allowRemoteAccess?: boolean;
};
