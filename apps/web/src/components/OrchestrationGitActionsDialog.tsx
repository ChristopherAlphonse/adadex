import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

import type { CoordinationGitStatusSnapshot, CoordinationPullRequestSnapshot } from "../app/types";
import { ActionButton } from "./ui/ActionButton";

type OrchestrationGitActionsDialogProps = {
  coordinationId: string;
  coordinationName: string;
  gitStatus: CoordinationGitStatusSnapshot | null;
  gitPullRequest: CoordinationPullRequestSnapshot | null;
  gitCommitMessage: string;
  isLoading: boolean;
  isMutating: boolean;
  errorMessage: string | null;
  onCommitMessageChange: (value: string) => void;
  onClose: () => void;
  onCommit: () => void;
  onCommitAndPush: () => void;
  onPush: () => void;
  onSync: () => void;
  onMergePullRequest: () => void;
  onCleanupWorktree: () => void;
};

const renderDirtyState = (isDirty: boolean) => (isDirty ? "Dirty" : "Clean");

export const OrchestrationGitActionsDialog = ({
  coordinationId,
  coordinationName,
  gitStatus,
  gitPullRequest,
  gitCommitMessage,
  isLoading,
  isMutating,
  errorMessage,
  onCommitMessageChange,
  onClose,
  onCommit,
  onCommitAndPush,
  onPush,
  onSync,
  onMergePullRequest,
  onCleanupWorktree,
}: OrchestrationGitActionsDialogProps) => {
  const [isCommitMenuOpen, setIsCommitMenuOpen] = useState(false);

  useEffect(() => {
    if (isLoading || isMutating) {
      setIsCommitMenuOpen(false);
    }
  }, [isLoading, isMutating]);

  const globalDisabledReason = isLoading
    ? "Git lifecycle snapshot is loading."
    : isMutating
      ? "Another git action is currently running."
      : null;

  const commitDisabledReason =
    globalDisabledReason ??
    (gitCommitMessage.trim().length === 0 ? "Commit blocked: enter a commit message." : null);
  const commitAndPushDisabledReason = commitDisabledReason;

  const pushDisabledReason =
    globalDisabledReason ??
    ((gitStatus?.aheadCount ?? 0) <= 0
      ? "Push blocked: no local commits ahead of upstream."
      : null);

  const syncDisabledReason =
    globalDisabledReason ??
    (gitStatus?.isDirty ? "Sync blocked: worktree has uncommitted changes." : null);

  const hasOpenPullRequest = gitPullRequest?.status === "open";
  const canMergePullRequest =
    hasOpenPullRequest &&
    gitPullRequest?.isDraft !== true &&
    gitPullRequest?.mergeable !== "CONFLICTING";
  const mergePullRequestDisabledReason =
    globalDisabledReason ??
    (!hasOpenPullRequest
      ? "Merge blocked: no open pull request."
      : gitPullRequest?.isDraft === true
        ? "Merge blocked: pull request is still a draft."
        : gitPullRequest?.mergeable === "CONFLICTING"
          ? "Merge blocked: pull request has merge conflicts."
          : canMergePullRequest
            ? null
            : "Merge blocked: pull request is not mergeable yet.");

  const cleanupDisabledReason = globalDisabledReason;

  return (
    <section
      aria-label={`Git actions for ${coordinationId}`}
      className="git-actions-dialog"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          if (isCommitMenuOpen) {
            event.preventDefault();
            setIsCommitMenuOpen(false);
            return;
          }
          if (!isMutating) {
            event.preventDefault();
            onClose();
          }
        }
      }}
      tabIndex={-1}
    >
      <header className="git-actions-header">
        <h2>Worktree Git Actions</h2>
        <div className="git-actions-header-actions">
          <span className="pill git-actions-worktree-badge">WORKTREE</span>
          <ActionButton
            aria-label="Close sidebar action panel"
            className="git-actions-close"
            disabled={isMutating}
            onClick={onClose}
            size="dense"
            variant="accent"
          >
            Close
          </ActionButton>
        </div>
      </header>
      <div className="git-actions-body">
        <p className="git-actions-message">
          Manage git lifecycle for <strong>{coordinationName}</strong> ({coordinationId}).
        </p>
        {isLoading ? (
          <p className="git-actions-loading">Loading git status...</p>
        ) : gitStatus ? (
          <dl className="git-actions-status">
            <div>
              <dt>Branch</dt>
              <dd>{gitStatus.branchName}</dd>
            </div>
            <div>
              <dt>Upstream</dt>
              <dd>{gitStatus.upstreamBranchName ?? "Not set"}</dd>
            </div>
            <div>
              <dt>State</dt>
              <dd>{renderDirtyState(gitStatus.isDirty)}</dd>
            </div>
            <div>
              <dt>Sync</dt>
              <dd className="git-actions-sync-metric">
                <span className="git-actions-ahead-count">{gitStatus.aheadCount}</span>
                <span className="git-actions-metric-separator">/</span>
                <span className="git-actions-behind-count">{gitStatus.behindCount}</span>
              </dd>
            </div>
            <div>
              <dt>Line diff</dt>
              <dd className="git-actions-line-diff-metric">
                <span className="git-actions-insertions-count">+{gitStatus.insertedLineCount}</span>
                <span className="git-actions-metric-separator">/</span>
                <span className="git-actions-deletions-count">-{gitStatus.deletedLineCount}</span>
              </dd>
            </div>
          </dl>
        ) : (
          <p className="git-actions-loading">No git status available.</p>
        )}

        <section className="git-actions-commit-panel" aria-label="Source control composer">
          <label className="git-actions-commit-label" htmlFor="git-actions-commit-input">
            Message
          </label>
          <textarea
            aria-label={`Commit message for ${coordinationId}`}
            className="git-actions-message-input"
            id="git-actions-commit-input"
            onChange={(event) => {
              onCommitMessageChange(event.target.value);
            }}
            placeholder="feat: something"
            rows={3}
            value={gitCommitMessage}
          />
          <div className="git-actions-commit-controls">
            <ActionButton
              aria-label="Commit changes"
              className="git-actions-commit-main"
              disabled={Boolean(commitDisabledReason)}
              onClick={onCommit}
              size="dense"
              variant="accent"
            >
              {isMutating ? "Running..." : "Commit"}
            </ActionButton>
            <button
              aria-expanded={isCommitMenuOpen}
              aria-haspopup="menu"
              aria-label="Open commit options"
              className="git-actions-commit-toggle"
              disabled={Boolean(globalDisabledReason)}
              onClick={() => {
                setIsCommitMenuOpen((current) => !current);
              }}
              type="button"
            >
              <ChevronDown size={14} />
            </button>
          </div>
          {isCommitMenuOpen && (
            <div className="git-actions-commit-menu" role="menu">
              <button
                className="git-actions-commit-menu-item"
                disabled={Boolean(commitDisabledReason)}
                onClick={() => {
                  setIsCommitMenuOpen(false);
                  onCommit();
                }}
                role="menuitem"
                type="button"
              >
                Commit
              </button>
              <button
                className="git-actions-commit-menu-item"
                disabled={Boolean(commitAndPushDisabledReason)}
                onClick={() => {
                  setIsCommitMenuOpen(false);
                  onCommitAndPush();
                }}
                role="menuitem"
                type="button"
              >
                Commit & Push
              </button>
              <button
                className="git-actions-commit-menu-item"
                disabled={Boolean(pushDisabledReason)}
                onClick={() => {
                  setIsCommitMenuOpen(false);
                  onPush();
                }}
                role="menuitem"
                type="button"
              >
                Push
              </button>
              <button
                className="git-actions-commit-menu-item"
                disabled={Boolean(syncDisabledReason)}
                onClick={() => {
                  setIsCommitMenuOpen(false);
                  onSync();
                }}
                role="menuitem"
                type="button"
              >
                Sync with Base
              </button>
            </div>
          )}
          {commitDisabledReason && <p className="git-action-reason">{commitDisabledReason}</p>}
          {pushDisabledReason && <p className="git-action-hint">{pushDisabledReason}</p>}
          {syncDisabledReason ? (
            <p className="git-action-hint">{syncDisabledReason}</p>
          ) : (
            <p className="git-action-hint">Sync is ready. Use the commit menu to run sync.</p>
          )}
        </section>

        <section className="git-actions-pr-section" aria-label="Pull request workflow">
          <div className="git-actions-pr-header">
            <h3>Pull request</h3>
            <p className="git-actions-pr-status">
              Status: {gitPullRequest?.status ?? "none"}
              {gitPullRequest?.number ? ` · #${gitPullRequest.number}` : ""}
            </p>
          </div>
          <p className="git-action-hint">
            Create pull requests directly in GitHub after pushing your branch.
          </p>
          <div className="git-actions-pr-buttons">
            <ActionButton
              aria-label="Merge pull request"
              className="git-actions-merge-pr"
              disabled={Boolean(mergePullRequestDisabledReason)}
              onClick={onMergePullRequest}
              size="dense"
              variant="info"
            >
              Merge pull request
            </ActionButton>
            <ActionButton
              aria-label="Open pull request in GitHub"
              className="git-actions-open-pr"
              disabled={!gitPullRequest?.url}
              onClick={() => {
                if (!gitPullRequest?.url) {
                  return;
                }
                globalThis.open?.(gitPullRequest.url, "_blank", "noopener,noreferrer");
              }}
              size="dense"
              variant="accent"
            >
              Open on GitHub
            </ActionButton>
          </div>
          {mergePullRequestDisabledReason && (
            <p className="git-action-reason">{mergePullRequestDisabledReason}</p>
          )}
          {!gitPullRequest?.url && (
            <p className="git-action-hint">No pull request URL detected for this branch yet.</p>
          )}
        </section>

        <div className="git-action-row git-action-row--cleanup">
          <div className="git-action-content">
            <p className="git-action-title">Cleanup worktree</p>
            <p className="git-action-hint">
              Deletes the worktree directory and branch after confirmation.
            </p>
            {cleanupDisabledReason && <p className="git-action-reason">{cleanupDisabledReason}</p>}
          </div>
          <ActionButton
            aria-label="Cleanup worktree"
            className="git-actions-cleanup"
            disabled={Boolean(cleanupDisabledReason)}
            onClick={onCleanupWorktree}
            size="dense"
            variant="danger"
          >
            Cleanup worktree
          </ActionButton>
        </div>

        {errorMessage && <p className="git-actions-error">{errorMessage}</p>}
      </div>
    </section>
  );
};
