import type { ReactNode } from "react";

import { ActionButton } from "./ActionButton";
import { StatusBadge } from "./StatusBadge";

type ConfirmationDialogProps = {
  title: string;
  ariaLabel: string;
  message: ReactNode;
  warning: string;
  confirmLabel: string;
  isConfirmDisabled: boolean;
  isBusy: boolean;
  cancelAriaLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  children?: ReactNode;
};

export const ConfirmationDialog = ({
  title,
  ariaLabel,
  message,
  warning,
  confirmLabel,
  isConfirmDisabled,
  isBusy,
  cancelAriaLabel,
  onCancel,
  onConfirm,
  children,
}: ConfirmationDialogProps) => (
  <section
    aria-label={ariaLabel}
    className="delete-confirm-dialog w-full border border-primary bg-surface"
    onKeyDown={(event) => {
      if (event.key !== "Escape" || isBusy) return;
      event.preventDefault();
      onCancel();
    }}
    tabIndex={-1}
  >
    <header className="delete-confirm-header flex items-center justify-between gap-3 border-b border-border bg-primary px-3 py-2">
      <h2 className="m-0 font-mono text-sm font-bold tracking-wide text-primary-foreground uppercase">
        {title}
      </h2>
      <div className="delete-confirm-header-actions inline-flex items-center gap-2">
        <StatusBadge tone="blocked" label="DESTRUCTIVE" />
        <ActionButton
          aria-label="Close confirmation"
          className="delete-confirm-close"
          disabled={isBusy}
          onClick={onCancel}
          size="dense"
          variant="accent"
        >
          Close
        </ActionButton>
      </div>
    </header>
    <div className="delete-confirm-body grid gap-2 p-3">
      <p className="delete-confirm-message m-0 font-mono text-[0.78rem] text-primary">{message}</p>
      <p className="delete-confirm-warning m-0 border border-destructive/40 bg-destructive/10 px-2 py-1.5 font-mono text-[0.72rem] text-destructive">
        {warning}
      </p>
      {children}
    </div>
    <div className="delete-confirm-actions flex justify-end gap-2 border-t border-border p-3">
      <ActionButton
        aria-label={cancelAriaLabel ?? "Cancel"}
        className="delete-confirm-cancel"
        disabled={isBusy}
        onClick={onCancel}
        size="dense"
        variant="accent"
      >
        Cancel
      </ActionButton>
      <ActionButton
        aria-label={`Confirm ${title.toLowerCase()}`}
        className="delete-confirm-submit"
        disabled={isConfirmDisabled}
        onClick={onConfirm}
        size="dense"
        variant="danger"
      >
        {confirmLabel}
      </ActionButton>
    </div>
  </section>
);
