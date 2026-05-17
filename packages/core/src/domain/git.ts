import type { CoordinationWorkspaceMode } from "./terminal";

export type CoordinationPullRequestStatus = "none" | "open" | "merged" | "closed";

export type CoordinationGitStatusSnapshot = {
  coordinationId: string;
  workspaceMode: CoordinationWorkspaceMode;
  branchName: string;
  headCommit?: string | null;
  worktreePath?: string | null;
  upstreamBranchName: string | null;
  isDirty: boolean;
  aheadCount: number;
  behindCount: number;
  insertedLineCount: number;
  deletedLineCount: number;
  hasConflicts: boolean;
  changedFiles: string[];
  defaultBaseBranchName: string | null;
};

export type CoordinationPullRequestSnapshot = {
  coordinationId: string;
  workspaceMode: CoordinationWorkspaceMode;
  status: CoordinationPullRequestStatus;
  number: number | null;
  url: string | null;
  title: string | null;
  baseRef: string | null;
  headRef: string | null;
  isDraft: boolean | null;
  mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN" | null;
  mergeStateStatus: string | null;
};
