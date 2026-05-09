import type { PendingDeleteTerminal } from "../app/hooks/useTerminalMutations";
import type {
  CoordinationGitStatusSnapshot,
  CoordinationPullRequestSnapshot,
  TerminalView,
} from "../app/types";
import { DeleteTentacleDialog } from "./DeleteTentacleDialog";
import { TentacleGitActionsDialog } from "./TentacleGitActionsDialog";

type SidebarActionPanelProps = {
  pendingDeleteTerminal: PendingDeleteTerminal | null;
  isDeletingTerminalId: string | null;
  clearPendingDeleteTerminal: () => void;
  confirmDeleteTerminal: () => Promise<void>;
  openGitTentacleId: string | null;
  columns: TerminalView;
  openGitTentacleStatus: CoordinationGitStatusSnapshot | null;
  openGitTentaclePullRequest: CoordinationPullRequestSnapshot | null;
  gitCommitMessageDraft: string;
  gitDialogError: string | null;
  isGitDialogLoading: boolean;
  isGitDialogMutating: boolean;
  setGitCommitMessageDraft: (value: string) => void;
  closeTentacleGitActions: () => void;
  commitTentacleChanges: () => Promise<void>;
  commitAndPushTentacleBranch: () => Promise<void>;
  pushTentacleBranch: () => Promise<void>;
  syncTentacleBranch: () => Promise<void>;
  mergeTentaclePullRequest: () => Promise<void>;
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
  openGitTentacleId,
  columns,
  openGitTentacleStatus,
  openGitTentaclePullRequest,
  gitCommitMessageDraft,
  gitDialogError,
  isGitDialogLoading,
  isGitDialogMutating,
  setGitCommitMessageDraft,
  closeTentacleGitActions,
  commitTentacleChanges,
  commitAndPushTentacleBranch,
  pushTentacleBranch,
  syncTentacleBranch,
  mergeTentaclePullRequest,
  requestDeleteTerminal,
}: SidebarActionPanelProps) => {
  const openGitTentacleTerminal =
    openGitTentacleId !== null
      ? columns.find((terminal) => terminal.coordinationId === openGitTentacleId)
      : null;

  if (pendingDeleteTerminal) {
    return (
      <DeleteTentacleDialog
        isDeletingTerminalId={isDeletingTerminalId}
        onCancel={clearPendingDeleteTerminal}
        onConfirmDelete={() => {
          void confirmDeleteTerminal();
        }}
        pendingDeleteTerminal={pendingDeleteTerminal}
      />
    );
  }

  if (openGitTentacleTerminal && openGitTentacleTerminal.workspaceMode === "worktree") {
    return (
      <TentacleGitActionsDialog
        errorMessage={gitDialogError}
        gitCommitMessage={gitCommitMessageDraft}
        gitPullRequest={openGitTentaclePullRequest}
        gitStatus={openGitTentacleStatus}
        isLoading={isGitDialogLoading}
        isMutating={isGitDialogMutating}
        onClose={closeTentacleGitActions}
        onCommit={() => {
          void commitTentacleChanges();
        }}
        onCommitAndPush={() => {
          void commitAndPushTentacleBranch();
        }}
        onCommitMessageChange={setGitCommitMessageDraft}
        onMergePullRequest={() => {
          void mergeTentaclePullRequest();
        }}
        onPush={() => {
          void pushTentacleBranch();
        }}
        onSync={() => {
          void syncTentacleBranch();
        }}
        onCleanupWorktree={() => {
          requestDeleteTerminal(
            openGitTentacleTerminal.terminalId,
            openGitTentacleTerminal.coordinationName ?? openGitTentacleTerminal.coordinationId,
            {
              workspaceMode: openGitTentacleTerminal.workspaceMode ?? "shared",
              intent: "cleanup-worktree",
            },
          );
          closeTentacleGitActions();
        }}
        coordinationId={openGitTentacleTerminal.coordinationId}
        coordinationName={
          openGitTentacleTerminal.coordinationName ?? openGitTentacleTerminal.coordinationId
        }
      />
    );
  }

  return null;
};
