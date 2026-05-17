import type {
  CoordinationGitStatusSnapshot,
  CoordinationPullRequestSnapshot,
  GitClient,
  PersistedTerminal,
} from "./types";
import { RuntimeInputError } from "./types";
import type { createWorktreeManager } from "./worktreeManager";

type WorktreeManager = ReturnType<typeof createWorktreeManager>;

export const createGitOperations = (deps: {
  terminals: Map<string, PersistedTerminal>;
  worktreeManager: WorktreeManager;
  gitClient: GitClient;
}) => {
  const { terminals, worktreeManager, gitClient } = deps;

  const resolveWorktreeOrchestrationContext = (
    coordinationId: string,
  ): { terminal: PersistedTerminal; workspaceCwd: string } | null => {
    // Find any terminal belonging to this orchestration
    let terminal: PersistedTerminal | undefined;
    for (const t of terminals.values()) {
      if (t.coordinationId === coordinationId) {
        terminal = t;
        break;
      }
    }
    if (!terminal) {
      return null;
    }

    if (terminal.workspaceMode !== "worktree") {
      throw new RuntimeInputError(
        "Git lifecycle actions are only available for worktree terminals.",
      );
    }

    return {
      terminal,
      workspaceCwd: worktreeManager.getOrchestrationWorkspaceCwd(
        terminal.worktreeId ?? terminal.coordinationId,
      ),
    };
  };

  const readWorktreeGitStatus = (
    coordinationId: string,
    terminal: PersistedTerminal,
    workspaceCwd: string,
  ): CoordinationGitStatusSnapshot => {
    try {
      const status = gitClient.readWorktreeStatus({ cwd: workspaceCwd });
      return {
        coordinationId,
        workspaceMode: terminal.workspaceMode,
        branchName: status.branchName,
        headCommit: status.headCommit,
        worktreePath: status.worktreePath,
        upstreamBranchName: status.upstreamBranchName,
        isDirty: status.isDirty,
        aheadCount: status.aheadCount,
        behindCount: status.behindCount,
        insertedLineCount: status.insertedLineCount,
        deletedLineCount: status.deletedLineCount,
        hasConflicts: status.hasConflicts,
        changedFiles: [...status.changedFiles],
        defaultBaseBranchName: status.defaultBaseBranchName,
      };
    } catch (error) {
      throw new RuntimeInputError(
        `Unable to read git status for ${coordinationId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  };

  const toPullRequestStatus = (state: "OPEN" | "MERGED" | "CLOSED") =>
    state === "OPEN" ? "open" : state === "MERGED" ? "merged" : "closed";

  const emptyPullRequestSnapshot = (
    coordinationId: string,
    terminal: PersistedTerminal,
  ): CoordinationPullRequestSnapshot => ({
    coordinationId,
    workspaceMode: terminal.workspaceMode,
    status: "none",
    number: null,
    url: null,
    title: null,
    baseRef: null,
    headRef: null,
    isDraft: null,
    mergeable: null,
    mergeStateStatus: null,
  });

  const readWorktreePullRequest = (
    coordinationId: string,
    terminal: PersistedTerminal,
    workspaceCwd: string,
  ): CoordinationPullRequestSnapshot => {
    try {
      const pullRequest = gitClient.readCurrentBranchPullRequest({ cwd: workspaceCwd });
      if (!pullRequest) {
        return emptyPullRequestSnapshot(coordinationId, terminal);
      }

      return {
        coordinationId,
        workspaceMode: terminal.workspaceMode,
        status: toPullRequestStatus(pullRequest.state),
        number: pullRequest.number,
        url: pullRequest.url,
        title: pullRequest.title,
        baseRef: pullRequest.baseRef,
        headRef: pullRequest.headRef,
        isDraft: pullRequest.isDraft,
        mergeable: pullRequest.mergeable,
        mergeStateStatus: pullRequest.mergeStateStatus,
      };
    } catch (error) {
      throw new RuntimeInputError(
        `Unable to read pull request for ${coordinationId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  };

  return {
    readOrchestrationGitStatus(coordinationId: string): CoordinationGitStatusSnapshot | null {
      const context = resolveWorktreeOrchestrationContext(coordinationId);
      if (!context) {
        return null;
      }

      return readWorktreeGitStatus(coordinationId, context.terminal, context.workspaceCwd);
    },

    commitOrchestrationWorktree(
      coordinationId: string,
      message: string,
    ): CoordinationGitStatusSnapshot | null {
      const context = resolveWorktreeOrchestrationContext(coordinationId);
      if (!context) {
        return null;
      }

      const trimmedMessage = message.trim();
      if (trimmedMessage.length === 0) {
        throw new RuntimeInputError("Commit message cannot be empty.");
      }

      try {
        gitClient.commitAll({
          cwd: context.workspaceCwd,
          message: trimmedMessage,
        });
      } catch (error) {
        throw new RuntimeInputError(
          `Unable to commit ${coordinationId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      return readWorktreeGitStatus(coordinationId, context.terminal, context.workspaceCwd);
    },

    pushOrchestrationWorktree(coordinationId: string): CoordinationGitStatusSnapshot | null {
      const context = resolveWorktreeOrchestrationContext(coordinationId);
      if (!context) {
        return null;
      }

      try {
        gitClient.pushCurrentBranch({
          cwd: context.workspaceCwd,
        });
      } catch (error) {
        throw new RuntimeInputError(
          `Unable to push ${coordinationId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      return readWorktreeGitStatus(coordinationId, context.terminal, context.workspaceCwd);
    },

    syncOrchestrationWorktree(
      coordinationId: string,
      baseRef?: string,
    ): CoordinationGitStatusSnapshot | null {
      const context = resolveWorktreeOrchestrationContext(coordinationId);
      if (!context) {
        return null;
      }

      const statusBeforeSync = readWorktreeGitStatus(
        coordinationId,
        context.terminal,
        context.workspaceCwd,
      );
      if (statusBeforeSync.isDirty) {
        throw new RuntimeInputError(
          "Sync requires a clean worktree. Commit or stash changes first.",
        );
      }
      if (statusBeforeSync.hasConflicts) {
        throw new RuntimeInputError("Resolve git conflicts before syncing with base.");
      }

      const normalizedBaseRef = baseRef?.trim();
      const effectiveBaseRef =
        normalizedBaseRef && normalizedBaseRef.length > 0
          ? normalizedBaseRef
          : (statusBeforeSync.defaultBaseBranchName ?? "main");

      try {
        gitClient.syncWithBase({
          cwd: context.workspaceCwd,
          baseRef: effectiveBaseRef,
        });
      } catch (error) {
        throw new RuntimeInputError(
          `Unable to sync ${coordinationId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      return readWorktreeGitStatus(coordinationId, context.terminal, context.workspaceCwd);
    },

    readOrchestrationPullRequest(coordinationId: string): CoordinationPullRequestSnapshot | null {
      const context = resolveWorktreeOrchestrationContext(coordinationId);
      if (!context) {
        return null;
      }

      return readWorktreePullRequest(coordinationId, context.terminal, context.workspaceCwd);
    },

    createOrchestrationPullRequest(
      coordinationId: string,
      input: { title: string; body?: string; baseRef?: string },
    ): CoordinationPullRequestSnapshot | null {
      const context = resolveWorktreeOrchestrationContext(coordinationId);
      if (!context) {
        return null;
      }

      const title = input.title.trim();
      if (title.length === 0) {
        throw new RuntimeInputError("Pull request title cannot be empty.");
      }

      const existingPullRequest = readWorktreePullRequest(
        coordinationId,
        context.terminal,
        context.workspaceCwd,
      );
      if (existingPullRequest.status === "open") {
        throw new RuntimeInputError("An open pull request already exists for this branch.");
      }

      const status = readWorktreeGitStatus(coordinationId, context.terminal, context.workspaceCwd);
      if (status.hasConflicts) {
        throw new RuntimeInputError("Resolve git conflicts before creating a pull request.");
      }

      const normalizedBaseRef = input.baseRef?.trim();
      const effectiveBaseRef =
        normalizedBaseRef && normalizedBaseRef.length > 0
          ? normalizedBaseRef
          : (status.defaultBaseBranchName ?? "main");

      try {
        const pullRequest = gitClient.createPullRequest({
          cwd: context.workspaceCwd,
          title,
          body: input.body ?? "",
          baseRef: effectiveBaseRef,
          headRef: status.branchName,
        });
        if (!pullRequest) {
          return readWorktreePullRequest(coordinationId, context.terminal, context.workspaceCwd);
        }

        return {
          coordinationId,
          workspaceMode: context.terminal.workspaceMode,
          status: toPullRequestStatus(pullRequest.state),
          number: pullRequest.number,
          url: pullRequest.url,
          title: pullRequest.title,
          baseRef: pullRequest.baseRef,
          headRef: pullRequest.headRef,
          isDraft: pullRequest.isDraft,
          mergeable: pullRequest.mergeable,
          mergeStateStatus: pullRequest.mergeStateStatus,
        };
      } catch (error) {
        throw new RuntimeInputError(
          `Unable to create pull request for ${coordinationId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    },

    mergeOrchestrationPullRequest(coordinationId: string): CoordinationPullRequestSnapshot | null {
      const context = resolveWorktreeOrchestrationContext(coordinationId);
      if (!context) {
        return null;
      }

      const currentPullRequest = readWorktreePullRequest(
        coordinationId,
        context.terminal,
        context.workspaceCwd,
      );
      if (currentPullRequest.status !== "open") {
        throw new RuntimeInputError("No open pull request found for this branch.");
      }
      if (currentPullRequest.isDraft) {
        throw new RuntimeInputError("Draft pull requests cannot be merged.");
      }
      if (currentPullRequest.mergeable === "CONFLICTING") {
        throw new RuntimeInputError("Pull request has conflicts and cannot be merged.");
      }

      try {
        gitClient.mergeCurrentBranchPullRequest({
          cwd: context.workspaceCwd,
          strategy: "squash",
        });
      } catch (error) {
        throw new RuntimeInputError(
          `Unable to merge pull request for ${coordinationId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      return readWorktreePullRequest(coordinationId, context.terminal, context.workspaceCwd);
    },
  };
};
