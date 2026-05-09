import type { ReactNode } from "react";

import { ActionButton } from "./ActionButton";

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
    className="delete-confirm-dialog"
    onKeyDown={(event) => {
      if (event.key !== "Escape" || isBusy) return;
      event.preventDefault();
      onCancel();
    }}
    tabIndex={-1}
  >
    <header className="delete-confirm-header">
      <h2>{title}</h2>
      <div className="delete-confirm-header-actions">
        <span className="pill blocked">DESTRUCTIVE</span>
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
    <div className="delete-confirm-body">
      <p className="delete-confirm-message">{message}</p>
      <p className="delete-confirm-warning">{warning}</p>
      {children}
    </div>
    <div className="delete-confirm-actions">
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
