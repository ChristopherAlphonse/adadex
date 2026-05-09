import { buildGithubSummaryUrl } from "../../runtime/runtimeEndpoints";
import { GITHUB_SUMMARY_SCAN_INTERVAL_MS } from "../constants";
import { normalizeGitHubRepoSummarySnapshot } from "../githubNormalizers";
import type { GitHubRepoSummarySnapshot } from "../types";
import { usePollingData } from "./usePollingData";

const fallback = (): GitHubRepoSummarySnapshot => ({
  status: "error",
  source: "none",
  fetchedAt: new Date().toISOString(),
  message: "Unable to read GitHub summary.",
  commitsPerDay: [],
});

export const useGithubSummaryPolling = () => {
  const { data, isLoading, refresh } = usePollingData<GitHubRepoSummarySnapshot>({
    fetchUrl: buildGithubSummaryUrl(),
    intervalMs: GITHUB_SUMMARY_SCAN_INTERVAL_MS,
    normalize: normalizeGitHubRepoSummarySnapshot,
    fallback,
  });

  return {
    githubRepoSummary: data,
    isRefreshingGitHubSummary: isLoading,
    refreshGitHubRepoSummary: refresh,
  };
};
