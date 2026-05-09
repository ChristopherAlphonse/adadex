import type { GitHubCommitPoint, buildTerminalList } from "@adadex/core";

export type TerminalView = Awaited<ReturnType<typeof buildTerminalList>>;

export type {
  CodexUsageSnapshot,
  GitHubCommitPoint,
  GitHubRecentCommit,
  GitHubRepoSummarySnapshot,
  TerminalAgentProvider,
  CoordinationGitStatusSnapshot,
  CoordinationPullRequestSnapshot,
  ConversationTurn,
  ConversationTranscriptEvent,
  ConversationSessionSummary,
  ConversationSessionDetail,
  ConversationSearchHit,
} from "@adadex/core";

export type { PersistedUiState as FrontendUiStateSnapshot } from "@adadex/core";
export type { CoordinationWorkspaceMode as TerminalWorkspaceMode } from "@adadex/core";

export type GitHubCommitSparkPoint = GitHubCommitPoint & {
  x: number;
  y: number;
};

export type PromptLibraryEntry = {
  name: string;
  source: "builtin" | "user";
};

export type PromptDetail = {
  name: string;
  source: "builtin" | "user";
  content: string;
};
