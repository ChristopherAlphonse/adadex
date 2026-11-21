import { ConfirmationDialog } from "./ui/ConfirmationDialog";

type DeleteConversationDialogProps = {
  title: string;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export const DeleteConversationDialog = ({
  title,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteConversationDialogProps) => (
  <ConfirmationDialog
    title="Delete Conversation"
    ariaLabel="Delete conversation confirmation"
    message={
      <>
        Delete <strong>{title}</strong> and its transcript data.
      </>
    }
    warning="This action cannot be undone."
    confirmLabel={isDeleting ? "Deleting..." : "Delete"}
    isConfirmDisabled={isDeleting}
    isBusy={isDeleting}
    cancelAriaLabel="Cancel delete"
    onCancel={onCancel}
    onConfirm={onConfirm}
  />
);
