import { useEffect, useState } from "react";

import type { PendingDeleteTerminal } from "../app/hooks/useTerminalMutations";
import { ConfirmationDialog } from "./ui/ConfirmationDialog";

type DeleteOrchestrationDialogProps = {
  pendingDeleteTerminal: PendingDeleteTerminal;
  isDeletingTerminalId: string | null;
  onCancel: () => void;
  onConfirmDelete: () => void;
};

export const DeleteOrchestrationDialog = ({
  pendingDeleteTerminal,
  isDeletingTerminalId,
  onCancel,
  onConfirmDelete,
}: DeleteOrchestrationDialogProps) => {
  const [cleanupConfirmationInput, setCleanupConfirmationInput] = useState("");
  const isCleanupIntent =
    pendingDeleteTerminal.intent === "cleanup-worktree" &&
    pendingDeleteTerminal.workspaceMode === "worktree";
  const isCloseIntent = pendingDeleteTerminal.intent === "close-terminal";
  const isCleanupConfirmationValid =
    !isCleanupIntent || cleanupConfirmationInput.trim() === pendingDeleteTerminal.terminalId;
  // Only treat *this* orchestration as busy. A stale `isDeletingTerminalId` for another id would
  // otherwise keep confirm/cancel disabled and make the dialog feel "stuck".
  const isThisDeleting = isDeletingTerminalId === pendingDeleteTerminal.terminalId;
  const dialogResetKey = `${pendingDeleteTerminal.terminalId}:${pendingDeleteTerminal.intent}`;

  useEffect(() => {
    void dialogResetKey;
    setCleanupConfirmationInput("");
  }, [dialogResetKey]);

  return (
    <ConfirmationDialog
      title={
        isCleanupIntent
          ? "Cleanup Worktree Orchestration"
          : isCloseIntent
            ? "Close Terminal"
            : "Delete Orchestration"
      }
      ariaLabel={`${isCloseIntent ? "Close" : "Delete"} confirmation for ${pendingDeleteTerminal.terminalId}`}
      message={
        isCleanupIntent ? (
          <>
            Cleanup <strong>{pendingDeleteTerminal.coordinationName}</strong> and delete the
            orchestration session metadata.
          </>
        ) : isCloseIntent ? (
          <>
            Close <strong>{pendingDeleteTerminal.coordinationName}</strong> and terminate its active
            terminal session.
          </>
        ) : (
          <>
            Delete <strong>{pendingDeleteTerminal.coordinationName}</strong> and terminate all of
            its active sessions.
          </>
        )
      }
      warning={
        isCleanupIntent
          ? "This action removes the worktree directory and local branch."
          : isCloseIntent
            ? "The transcript is preserved as an inactive session."
            : "This action cannot be undone."
      }
      confirmLabel={
        isThisDeleting
          ? "Closing..."
          : isCleanupIntent
            ? "Cleanup"
            : isCloseIntent
              ? "Close"
              : "Delete"
      }
      isConfirmDisabled={isThisDeleting || !isCleanupConfirmationValid}
      isBusy={isThisDeleting}
      cancelAriaLabel="Cancel delete"
      onCancel={onCancel}
      onConfirm={onConfirmDelete}
    >
      <dl className="delete-confirm-details">
        <div>
          <dt>Name</dt>
          <dd>{pendingDeleteTerminal.coordinationName}</dd>
        </div>
        <div>
          <dt>ID</dt>
          <dd>{pendingDeleteTerminal.terminalId}</dd>
        </div>
        <div>
          <dt>Mode</dt>
          <dd>{pendingDeleteTerminal.workspaceMode === "worktree" ? "worktree" : "shared"}</dd>
        </div>
      </dl>
      {isCleanupIntent && (
        <div className="delete-confirm-typed-check">
          <label htmlFor="cleanup-confirm-id-input">Type orchestration ID to confirm cleanup</label>
          <input
            aria-label="Type orchestration ID to confirm cleanup"
            id="cleanup-confirm-id-input"
            onChange={(event) => setCleanupConfirmationInput(event.target.value)}
            type="text"
            value={cleanupConfirmationInput}
          />
        </div>
      )}
    </ConfirmationDialog>
  );
};
