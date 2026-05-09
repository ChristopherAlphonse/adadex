import { asNumber, asRecord, asString } from "@adadex/core";

import type { GitHubCommitPoint, GitHubRecentCommit, GitHubRepoSummarySnapshot } from "./types";

const normalizeGitHubCommitPoint = (value: unknown): GitHubCommitPoint | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const date = asString(record.date);
  const count = asNumber(record.count);
  if (!date || count === null) {
    return null;
  }

  return {
    date,
    count: Math.max(0, Math.round(count)),
  };
};

const normalizeGitHubRecentCommit = (value: unknown): GitHubRecentCommit | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const hash = asString(record.hash)?.trim();
  const shortHash = asString(record.shortHash)?.trim();
  const subject = asString(record.subject)?.trim();
  const authorName = asString(record.authorName)?.trim();
  const authorEmail = asString(record.authorEmail)?.trim() ?? "";
  const authoredAt = asString(record.authoredAt)?.trim();
  const body = asString(record.body)?.trim() ?? "";
  const filesChanged = asNumber(record.filesChanged) ?? 0;
  const insertions = asNumber(record.insertions) ?? 0;
  const deletions = asNumber(record.deletions) ?? 0;
  if (!hash || !shortHash || !subject || !authorName || !authoredAt) {
    return null;
  }

  return {
    hash,
    shortHash,
    subject,
    authorName,
    authorEmail,
    authoredAt,
    body,
    filesChanged,
    insertions,
    deletions,
  };
};

export const normalizeGitHubRepoSummarySnapshot = (
  value: unknown,
): GitHubRepoSummarySnapshot | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const status = record.status;
  if (status !== "ok" && status !== "unavailable" && status !== "error") {
    return null;
  }

  const rawCommitsPerDay = Array.isArray(record.commitsPerDay) ? record.commitsPerDay : [];
  const commitsPerDay = rawCommitsPerDay
    .map((point) => normalizeGitHubCommitPoint(point))
    .filter((point): point is GitHubCommitPoint => point !== null);
  const rawRecentCommits = Array.isArray(record.recentCommits) ? record.recentCommits : [];
  const recentCommits = rawRecentCommits
    .map((commit) => normalizeGitHubRecentCommit(commit))
    .filter((commit): commit is GitHubRecentCommit => commit !== null);

  return {
    status,
    source: record.source === "gh-cli" ? "gh-cli" : "none",
    fetchedAt: asString(record.fetchedAt) ?? new Date().toISOString(),
    message: asString(record.message),
    repo: asString(record.repo),
    stargazerCount: asNumber(record.stargazerCount),
    openIssueCount: asNumber(record.openIssueCount),
    openPullRequestCount: asNumber(record.openPullRequestCount),
    commitsPerDay,
    recentCommits,
  };
};
