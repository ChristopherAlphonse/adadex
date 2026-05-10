import type { PendingDeleteTerminal } from "../app/hooks/useTerminalMutations";
import type {
  CoordinationGitStatusSnapshot,
  CoordinationPullRequestSnapshot,
  TerminalView,
} from "../app/types";
import { DeleteOrchestrationDialog } from "./DeleteOrchestrationDialog";
import { OrchestrationGitActionsDialog } from "./OrchestrationGitActionsDialog";

type SidebarActionPanelProps = {
  pendingDeleteTerminal: PendingDeleteTerminal | null;
  isDeletingTerminalId: string | null;
  clearPendingDeleteTerminal: () => void;
  confirmDeleteTerminal: () => Promise<void>;
  openGitOrchestrationId: string | null;
  columns: TerminalView;
  openGitOrchestrationStatus: CoordinationGitStatusSnapshot | null;
  openGitOrchestrationPullRequest: CoordinationPullRequestSnapshot | null;
  gitCommitMessageDraft: string;
  gitDialogError: string | null;
  isGitDialogLoading: boolean;
  isGitDialogMutating: boolean;
  setGitCommitMessageDraft: (value: string) => void;
  closeOrchestrationGitActions: () => void;
  commitOrchestrationChanges: () => Promise<void>;
  commitAndPushOrchestrationBranch: () => Promise<void>;
  pushOrchestrationBranch: () => Promise<void>;
  syncOrchestrationBranch: () => Promise<void>;
  mergeOrchestrationPullRequest: () => Promise<void>;
  requestDeleteTerminal: (
    coordinationId: string,
    coordinationName: string,
    options: {
      workspaceMode: "shared" | "worktree";
      intent: "delete-terminal" | "cleanup-worktree";
    },
  ) => void;
};

export const SidebarActionPanel = ({
  pendingDeleteTerminal,
  isDeletingTerminalId,
  clearPendingDeleteTerminal,
  confirmDeleteTerminal,
  openGitOrchestrationId,
  columns,
  openGitOrchestrationStatus,
  openGitOrchestrationPullRequest,
  gitCommitMessageDraft,
  gitDialogError,
  isGitDialogLoading,
  isGitDialogMutating,
  setGitCommitMessageDraft,
  closeOrchestrationGitActions,
  commitOrchestrationChanges,
  commitAndPushOrchestrationBranch,
  pushOrchestrationBranch,
  syncOrchestrationBranch,
  mergeOrchestrationPullRequest,
  requestDeleteTerminal,
}: SidebarActionPanelProps) => {
  const openGitOrchestrationTerminal =
    openGitOrchestrationId !== null
      ? columns.find((terminal) => terminal.coordinationId === openGitOrchestrationId)
      : null;

  if (pendingDeleteTerminal) {
    return (
      <DeleteOrchestrationDialog
        isDeletingTerminalId={isDeletingTerminalId}
        onCancel={clearPendingDeleteTerminal}
        onConfirmDelete={() => {
          void confirmDeleteTerminal();
        }}
        pendingDeleteTerminal={pendingDeleteTerminal}
      />
    );
  }

  if (openGitOrchestrationTerminal && openGitOrchestrationTerminal.workspaceMode === "worktree") {
    return (
      <OrchestrationGitActionsDialog
        errorMessage={gitDialogError}
        gitCommitMessage={gitCommitMessageDraft}
        gitPullRequest={openGitOrchestrationPullRequest}
        gitStatus={openGitOrchestrationStatus}
        isLoading={isGitDialogLoading}
        isMutating={isGitDialogMutating}
        onClose={closeOrchestrationGitActions}
        onCommit={() => {
          void commitOrchestrationChanges();
        }}
        onCommitAndPush={() => {
          void commitAndPushOrchestrationBranch();
        }}
        onCommitMessageChange={setGitCommitMessageDraft}
        onMergePullRequest={() => {
          void mergeOrchestrationPullRequest();
        }}
        onPush={() => {
          void pushOrchestrationBranch();
        }}
        onSync={() => {
          void syncOrchestrationBranch();
        }}
        onCleanupWorktree={() => {
          requestDeleteTerminal(
            openGitOrchestrationTerminal.terminalId,
            openGitOrchestrationTerminal.coordinationName ??
              openGitOrchestrationTerminal.coordinationId,
            {
              workspaceMode: openGitOrchestrationTerminal.workspaceMode ?? "shared",
              intent: "cleanup-worktree",
            },
          );
          closeOrchestrationGitActions();
        }}
        coordinationId={openGitOrchestrationTerminal.coordinationId}
        coordinationName={
          openGitOrchestrationTerminal.coordinationName ??
          openGitOrchestrationTerminal.coordinationId
        }
      />
    );
  }

  return null;
};
