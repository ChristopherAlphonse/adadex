import { useState } from "react";

import type { PendingDeleteTerminal } from "../../app/hooks/useTerminalMutations";

type SessionDeleteDialogProps = {
  pending: PendingDeleteTerminal;
  isDeletingTerminalId: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

const buttonBase =
  "h-8 rounded-lg px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export const SessionDeleteDialog = ({
  pending,
  isDeletingTerminalId,
  onCancel,
  onConfirm,
}: SessionDeleteDialogProps) => {
  const [typedId, setTypedId] = useState("");

  const isCleanup = pending.intent === "cleanup-worktree" && pending.workspaceMode === "worktree";
  const isClose = pending.intent === "close-terminal";
  const isBusy = isDeletingTerminalId === pending.terminalId;
  const canConfirm = !isBusy && (!isCleanup || typedId.trim() === pending.terminalId);

  const title = isCleanup ? "Clean up worktree?" : isClose ? "Close session?" : "Delete session?";

  const detail = isCleanup
    ? "This removes the worktree directory and its local branch, and deletes the session."
    : isClose
      ? "The session stops. Its transcript is kept as an inactive session."
      : "The session and anything running in it stops. This can't be undone.";

  const confirmLabel = isBusy ? "Working…" : isCleanup ? "Clean up" : isClose ? "Close" : "Delete";

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/55 p-4"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !isBusy) onCancel();
      }}
      role="presentation"
    >
      <dialog
        aria-label={`${isClose ? "Close" : "Delete"} confirmation for ${pending.terminalId}`}
        aria-modal="true"
        className="static m-0 w-[380px] max-w-full rounded-2xl border border-border bg-surface p-5 text-foreground shadow-2xl"
        open
      >
        <h2 className="m-0 text-base font-semibold text-foreground">{title}</h2>
        <p className="m-0 mt-1.5 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{pending.coordinationName}</span>
          {pending.workspaceMode === "worktree" ? " · worktree" : ""}
        </p>
        <p className="m-0 mt-3 text-sm text-muted-foreground">{detail}</p>

        {isCleanup ? (
          <label className="mt-4 flex flex-col gap-1.5 text-xs text-muted-foreground">
            Type {pending.terminalId} to confirm
            <input
              autoFocus
              className="h-8 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none focus:border-primary"
              onChange={(event) => {
                setTypedId(event.target.value);
              }}
              type="text"
              value={typedId}
            />
          </label>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            autoFocus={!isCleanup}
            className={`${buttonBase} text-foreground hover:bg-secondary`}
            disabled={isBusy}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className={`${buttonBase} bg-destructive text-white hover:opacity-90`}
            disabled={!canConfirm}
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </dialog>
    </div>
  );
};
