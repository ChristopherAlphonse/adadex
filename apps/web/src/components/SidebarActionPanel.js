import { jsx as _jsx } from "react/jsx-runtime";
import { DeleteOrchestrationDialog } from "./DeleteOrchestrationDialog";
import { OrchestrationGitActionsDialog } from "./OrchestrationGitActionsDialog";
export const SidebarActionPanel = ({ pendingDeleteTerminal, isDeletingTerminalId, clearPendingDeleteTerminal, confirmDeleteTerminal, openGitOrchestrationId, columns, openGitOrchestrationStatus, openGitOrchestrationPullRequest, gitCommitMessageDraft, gitDialogError, isGitDialogLoading, isGitDialogMutating, setGitCommitMessageDraft, closeOrchestrationGitActions, commitOrchestrationChanges, commitAndPushOrchestrationBranch, pushOrchestrationBranch, syncOrchestrationBranch, mergeOrchestrationPullRequest, requestDeleteTerminal, }) => {
    const openGitOrchestrationTerminal = openGitOrchestrationId !== null
        ? columns.find((terminal) => terminal.coordinationId === openGitOrchestrationId)
        : null;
    if (pendingDeleteTerminal) {
        return (_jsx(DeleteOrchestrationDialog, { isDeletingTerminalId: isDeletingTerminalId, onCancel: clearPendingDeleteTerminal, onConfirmDelete: () => {
                void confirmDeleteTerminal();
            }, pendingDeleteTerminal: pendingDeleteTerminal }));
    }
    if (openGitOrchestrationTerminal && openGitOrchestrationTerminal.workspaceMode === "worktree") {
        return (_jsx(OrchestrationGitActionsDialog, { errorMessage: gitDialogError, gitCommitMessage: gitCommitMessageDraft, gitPullRequest: openGitOrchestrationPullRequest, gitStatus: openGitOrchestrationStatus, isLoading: isGitDialogLoading, isMutating: isGitDialogMutating, onClose: closeOrchestrationGitActions, onCommit: () => {
                void commitOrchestrationChanges();
            }, onCommitAndPush: () => {
                void commitAndPushOrchestrationBranch();
            }, onCommitMessageChange: setGitCommitMessageDraft, onMergePullRequest: () => {
                void mergeOrchestrationPullRequest();
            }, onPush: () => {
                void pushOrchestrationBranch();
            }, onSync: () => {
                void syncOrchestrationBranch();
            }, onCleanupWorktree: () => {
                requestDeleteTerminal(openGitOrchestrationTerminal.terminalId, openGitOrchestrationTerminal.coordinationName ??
                    openGitOrchestrationTerminal.coordinationId, {
                    workspaceMode: openGitOrchestrationTerminal.workspaceMode ?? "shared",
                    intent: "cleanup-worktree",
                });
                closeOrchestrationGitActions();
            }, coordinationId: openGitOrchestrationTerminal.coordinationId, coordinationName: openGitOrchestrationTerminal.coordinationName ??
                openGitOrchestrationTerminal.coordinationId }));
    }
    return null;
};
