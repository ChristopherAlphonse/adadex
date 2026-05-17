import type { buildTerminalList, GitHubCommitPoint } from "@adadex/core";

export type TerminalView = Awaited<ReturnType<typeof buildTerminalList>>;

export type {
  CodexUsageSnapshot,
  ConversationSearchHit,
  ConversationSessionDetail,
  ConversationSessionSummary,
  ConversationTranscriptEvent,
  ConversationTurn,
  CoordinationGitStatusSnapshot,
  CoordinationPullRequestSnapshot,
  CoordinationWorkspaceMode as TerminalWorkspaceMode,
  GitHubCommitPoint,
  GitHubRecentCommit,
  GitHubRepoSummarySnapshot,
  PersistedUiState as FrontendUiStateSnapshot,
  TerminalAgentProvider,
} from "@adadex/core";

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
