import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { ActionButton } from "./ui/ActionButton";
const renderDirtyState = (isDirty) => (isDirty ? "Dirty" : "Clean");
export const OrchestrationGitActionsDialog = ({ coordinationId, coordinationName, gitStatus, gitPullRequest, gitCommitMessage, isLoading, isMutating, errorMessage, onCommitMessageChange, onClose, onCommit, onCommitAndPush, onPush, onSync, onMergePullRequest, onCleanupWorktree, }) => {
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
    const commitDisabledReason = globalDisabledReason ??
        (gitCommitMessage.trim().length === 0 ? "Commit blocked: enter a commit message." : null);
    const commitAndPushDisabledReason = commitDisabledReason;
    const pushDisabledReason = globalDisabledReason ??
        ((gitStatus?.aheadCount ?? 0) <= 0
            ? "Push blocked: no local commits ahead of upstream."
            : null);
    const syncDisabledReason = globalDisabledReason ??
        (gitStatus?.isDirty ? "Sync blocked: worktree has uncommitted changes." : null);
    const hasOpenPullRequest = gitPullRequest?.status === "open";
    const canMergePullRequest = hasOpenPullRequest &&
        gitPullRequest?.isDraft !== true &&
        gitPullRequest?.mergeable !== "CONFLICTING";
    const mergePullRequestDisabledReason = globalDisabledReason ??
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
    return (_jsxs("section", { "aria-label": `Git actions for ${coordinationId}`, className: "git-actions-dialog", onKeyDown: (event) => {
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
        }, tabIndex: -1, children: [_jsxs("header", { className: "git-actions-header", children: [_jsx("h2", { children: "Worktree Git Actions" }), _jsxs("div", { className: "git-actions-header-actions", children: [_jsx("span", { className: "pill git-actions-worktree-badge", children: "WORKTREE" }), _jsx(ActionButton, { "aria-label": "Close sidebar action panel", className: "git-actions-close", disabled: isMutating, onClick: onClose, size: "dense", variant: "accent", children: "Close" })] })] }), _jsxs("div", { className: "git-actions-body", children: [_jsxs("p", { className: "git-actions-message", children: ["Manage git lifecycle for ", _jsx("strong", { children: coordinationName }), " (", coordinationId, ")."] }), isLoading ? (_jsx("p", { className: "git-actions-loading", children: "Loading git status..." })) : gitStatus ? (_jsxs("dl", { className: "git-actions-status", children: [_jsxs("div", { children: [_jsx("dt", { children: "Branch" }), _jsx("dd", { children: gitStatus.branchName })] }), _jsxs("div", { children: [_jsx("dt", { children: "Upstream" }), _jsx("dd", { children: gitStatus.upstreamBranchName ?? "Not set" })] }), _jsxs("div", { children: [_jsx("dt", { children: "State" }), _jsx("dd", { children: renderDirtyState(gitStatus.isDirty) })] }), _jsxs("div", { children: [_jsx("dt", { children: "Sync" }), _jsxs("dd", { className: "git-actions-sync-metric", children: [_jsx("span", { className: "git-actions-ahead-count", children: gitStatus.aheadCount }), _jsx("span", { className: "git-actions-metric-separator", children: "/" }), _jsx("span", { className: "git-actions-behind-count", children: gitStatus.behindCount })] })] }), _jsxs("div", { children: [_jsx("dt", { children: "Line diff" }), _jsxs("dd", { className: "git-actions-line-diff-metric", children: [_jsxs("span", { className: "git-actions-insertions-count", children: ["+", gitStatus.insertedLineCount] }), _jsx("span", { className: "git-actions-metric-separator", children: "/" }), _jsxs("span", { className: "git-actions-deletions-count", children: ["-", gitStatus.deletedLineCount] })] })] })] })) : (_jsx("p", { className: "git-actions-loading", children: "No git status available." })), _jsxs("section", { className: "git-actions-commit-panel", "aria-label": "Source control composer", children: [_jsx("label", { className: "git-actions-commit-label", htmlFor: "git-actions-commit-input", children: "Message" }), _jsx("textarea", { "aria-label": `Commit message for ${coordinationId}`, className: "git-actions-message-input", id: "git-actions-commit-input", onChange: (event) => {
                                    onCommitMessageChange(event.target.value);
                                }, placeholder: "feat: something", rows: 3, value: gitCommitMessage }), _jsxs("div", { className: "git-actions-commit-controls", children: [_jsx(ActionButton, { "aria-label": "Commit changes", className: "git-actions-commit-main", disabled: Boolean(commitDisabledReason), onClick: onCommit, size: "dense", variant: "accent", children: isMutating ? "Running..." : "Commit" }), _jsx("button", { "aria-expanded": isCommitMenuOpen, "aria-haspopup": "menu", "aria-label": "Open commit options", className: "git-actions-commit-toggle", disabled: Boolean(globalDisabledReason), onClick: () => {
                                            setIsCommitMenuOpen((current) => !current);
                                        }, type: "button", children: _jsx(ChevronDown, { size: 14 }) })] }), isCommitMenuOpen && (_jsxs("div", { className: "git-actions-commit-menu", role: "menu", children: [_jsx("button", { className: "git-actions-commit-menu-item", disabled: Boolean(commitDisabledReason), onClick: () => {
                                            setIsCommitMenuOpen(false);
                                            onCommit();
                                        }, role: "menuitem", type: "button", children: "Commit" }), _jsx("button", { className: "git-actions-commit-menu-item", disabled: Boolean(commitAndPushDisabledReason), onClick: () => {
                                            setIsCommitMenuOpen(false);
                                            onCommitAndPush();
                                        }, role: "menuitem", type: "button", children: "Commit & Push" }), _jsx("button", { className: "git-actions-commit-menu-item", disabled: Boolean(pushDisabledReason), onClick: () => {
                                            setIsCommitMenuOpen(false);
                                            onPush();
                                        }, role: "menuitem", type: "button", children: "Push" }), _jsx("button", { className: "git-actions-commit-menu-item", disabled: Boolean(syncDisabledReason), onClick: () => {
                                            setIsCommitMenuOpen(false);
                                            onSync();
                                        }, role: "menuitem", type: "button", children: "Sync with Base" })] })), commitDisabledReason && _jsx("p", { className: "git-action-reason", children: commitDisabledReason }), pushDisabledReason && _jsx("p", { className: "git-action-hint", children: pushDisabledReason }), syncDisabledReason ? (_jsx("p", { className: "git-action-hint", children: syncDisabledReason })) : (_jsx("p", { className: "git-action-hint", children: "Sync is ready. Use the commit menu to run sync." }))] }), _jsxs("section", { className: "git-actions-pr-section", "aria-label": "Pull request workflow", children: [_jsxs("div", { className: "git-actions-pr-header", children: [_jsx("h3", { children: "Pull request" }), _jsxs("p", { className: "git-actions-pr-status", children: ["Status: ", gitPullRequest?.status ?? "none", gitPullRequest?.number ? ` · #${gitPullRequest.number}` : ""] })] }), _jsx("p", { className: "git-action-hint", children: "Create pull requests directly in GitHub after pushing your branch." }), _jsxs("div", { className: "git-actions-pr-buttons", children: [_jsx(ActionButton, { "aria-label": "Merge pull request", className: "git-actions-merge-pr", disabled: Boolean(mergePullRequestDisabledReason), onClick: onMergePullRequest, size: "dense", variant: "info", children: "Merge pull request" }), _jsx(ActionButton, { "aria-label": "Open pull request in GitHub", className: "git-actions-open-pr", disabled: !gitPullRequest?.url, onClick: () => {
                                            if (!gitPullRequest?.url) {
                                                return;
                                            }
                                            globalThis.open?.(gitPullRequest.url, "_blank", "noopener,noreferrer");
                                        }, size: "dense", variant: "accent", children: "Open on GitHub" })] }), mergePullRequestDisabledReason && (_jsx("p", { className: "git-action-reason", children: mergePullRequestDisabledReason })), !gitPullRequest?.url && (_jsx("p", { className: "git-action-hint", children: "No pull request URL detected for this branch yet." }))] }), _jsxs("div", { className: "git-action-row git-action-row--cleanup", children: [_jsxs("div", { className: "git-action-content", children: [_jsx("p", { className: "git-action-title", children: "Cleanup worktree" }), _jsx("p", { className: "git-action-hint", children: "Deletes the worktree directory and branch after confirmation." }), cleanupDisabledReason && _jsx("p", { className: "git-action-reason", children: cleanupDisabledReason })] }), _jsx(ActionButton, { "aria-label": "Cleanup worktree", className: "git-actions-cleanup", disabled: Boolean(cleanupDisabledReason), onClick: onCleanupWorktree, size: "dense", variant: "danger", children: "Cleanup worktree" })] }), errorMessage && _jsx("p", { className: "git-actions-error", children: errorMessage })] })] }));
};
