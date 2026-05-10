import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { ConfirmationDialog } from "./ui/ConfirmationDialog";
export const DeleteOrchestrationDialog = ({ pendingDeleteTerminal, isDeletingTerminalId, onCancel, onConfirmDelete, }) => {
    const [cleanupConfirmationInput, setCleanupConfirmationInput] = useState("");
    const isCleanupIntent = pendingDeleteTerminal.intent === "cleanup-worktree" &&
        pendingDeleteTerminal.workspaceMode === "worktree";
    const isCloseIntent = pendingDeleteTerminal.intent === "close-terminal";
    const isCleanupConfirmationValid = !isCleanupIntent || cleanupConfirmationInput.trim() === pendingDeleteTerminal.terminalId;
    // Only treat *this* orchestration as busy. A stale `isDeletingTerminalId` for another id would
    // otherwise keep confirm/cancel disabled and make the dialog feel "stuck".
    const isThisDeleting = isDeletingTerminalId === pendingDeleteTerminal.terminalId;
    const dialogResetKey = `${pendingDeleteTerminal.terminalId}:${pendingDeleteTerminal.intent}`;
    useEffect(() => {
        void dialogResetKey;
        setCleanupConfirmationInput("");
    }, [dialogResetKey]);
    return (_jsxs(ConfirmationDialog, { title: isCleanupIntent
            ? "Cleanup Worktree Orchestration"
            : isCloseIntent
                ? "Close Terminal"
                : "Delete Orchestration", ariaLabel: `${isCloseIntent ? "Close" : "Delete"} confirmation for ${pendingDeleteTerminal.terminalId}`, message: isCleanupIntent ? (_jsxs(_Fragment, { children: ["Cleanup ", _jsx("strong", { children: pendingDeleteTerminal.coordinationName }), " and delete the orchestration session metadata."] })) : isCloseIntent ? (_jsxs(_Fragment, { children: ["Close ", _jsx("strong", { children: pendingDeleteTerminal.coordinationName }), " and terminate its active terminal session."] })) : (_jsxs(_Fragment, { children: ["Delete ", _jsx("strong", { children: pendingDeleteTerminal.coordinationName }), " and terminate all of its active sessions."] })), warning: isCleanupIntent
            ? "This action removes the worktree directory and local branch."
            : isCloseIntent
                ? "The transcript is preserved as an inactive session."
                : "This action cannot be undone.", confirmLabel: isThisDeleting
            ? "Closing..."
            : isCleanupIntent
                ? "Cleanup"
                : isCloseIntent
                    ? "Close"
                    : "Delete", isConfirmDisabled: isThisDeleting || !isCleanupConfirmationValid, isBusy: isThisDeleting, cancelAriaLabel: "Cancel delete", onCancel: onCancel, onConfirm: onConfirmDelete, children: [_jsxs("dl", { className: "delete-confirm-details", children: [_jsxs("div", { children: [_jsx("dt", { children: "Name" }), _jsx("dd", { children: pendingDeleteTerminal.coordinationName })] }), _jsxs("div", { children: [_jsx("dt", { children: "ID" }), _jsx("dd", { children: pendingDeleteTerminal.terminalId })] }), _jsxs("div", { children: [_jsx("dt", { children: "Mode" }), _jsx("dd", { children: pendingDeleteTerminal.workspaceMode === "worktree" ? "worktree" : "shared" })] })] }), isCleanupIntent && (_jsxs("div", { className: "delete-confirm-typed-check", children: [_jsx("label", { htmlFor: "cleanup-confirm-id-input", children: "Type orchestration ID to confirm cleanup" }), _jsx("input", { "aria-label": "Type orchestration ID to confirm cleanup", id: "cleanup-confirm-id-input", onChange: (event) => setCleanupConfirmationInput(event.target.value), type: "text", value: cleanupConfirmationInput })] }))] }));
};
