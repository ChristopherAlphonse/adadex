import { describe, expect, it } from "vitest";

import { buildGitHubCommitSeries } from "../src/app/githubMetrics";
import type { GitHubRepoSummarySnapshot } from "../src/app/types";

const createSummary = (
  commitsPerDay: Array<{ date: string; count: number }>,
): GitHubRepoSummarySnapshot => ({
  status: "ok",
  fetchedAt: "2026-03-01T00:00:00.000Z",
  source: "gh-cli",
  repo: "hesamsheikh/octogent",
  stargazerCount: 0,
  openIssueCount: 0,
  openPullRequestCount: 0,
  commitsPerDay,
});

describe("github metrics", () => {
  it("trims leading zero-count days before the first commit", () => {
    const series = buildGitHubCommitSeries(
      createSummary([
        { date: "2026-02-21", count: 0 },
        { date: "2026-02-22", count: 0 },
        { date: "2026-02-23", count: 0 },
        { date: "2026-02-24", count: 2 },
        { date: "2026-02-25", count: 1 },
      ]),
    );

    expect(series).toEqual([
      { date: "2026-02-24", count: 2 },
      { date: "2026-02-25", count: 1 },
    ]);
  });

  it("keeps the input range when no commits exist yet", () => {
    const series = buildGitHubCommitSeries(
      createSummary([
        { date: "2026-02-21", count: 0 },
        { date: "2026-02-22", count: 0 },
        { date: "2026-02-23", count: 0 },
      ]),
    );

    expect(series).toEqual([
      { date: "2026-02-21", count: 0 },
      { date: "2026-02-22", count: 0 },
      { date: "2026-02-23", count: 0 },
    ]);
  });
});
