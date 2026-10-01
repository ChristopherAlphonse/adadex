export type GitHubCommitPoint = {
  date: string;
  count: number;
};

export type GitHubRecentCommit = {
  hash: string;
  shortHash: string;
  subject: string;
  authorName: string;
  authorEmail: string;
  authoredAt: string;
  body: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
};

export type GitHubRepoSummarySnapshot = {
  status: "ok" | "unavailable" | "error";
  fetchedAt: string;
  source: "gh-cli" | "none";
  message?: string | null;
  repo?: string | null;
  stargazerCount?: number | null;
  openIssueCount?: number | null;
  openPullRequestCount?: number | null;
  commitsPerDay?: GitHubCommitPoint[];
  recentCommits?: GitHubRecentCommit[];
};
