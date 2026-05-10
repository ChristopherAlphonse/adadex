import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useMemo, useState } from "react";
import { ActionButton } from "../ui/ActionButton";
const readDeleteFailureMessage = async (response, fallback) => {
    try {
        const payload = (await response.json());
        if (typeof payload.error === "string" && payload.error.trim().length > 0) {
            return payload.error;
        }
    }
    catch {
        // Ignore malformed error payloads and fall back to the status line.
    }
    return fallback;
};
export const DeleteAllTerminalsDialog = ({ columns, nodes, onCancel, onDeleted, }) => {
    const [inactiveOnly, setInactiveOnly] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    const [progress, setProgress] = useState(null);
    const [failureMessages, setFailureMessages] = useState([]);
    const inactiveTerminals = useMemo(() => columns.filter((t) => !t.hasUserPrompt), [columns]);
    const inactiveSessionIds = useMemo(() => nodes.flatMap((node) => node.type === "inactive-session" && node.sessionId ? [node.sessionId] : []), [nodes]);
    const activeTargets = inactiveOnly ? inactiveTerminals : columns;
    const totalTargetCount = activeTargets.length + inactiveSessionIds.length;
    const handleConfirm = useCallback(async () => {
        if (totalTargetCount === 0)
            return;
        setFailureMessages([]);
        setIsDeleting(true);
        setProgress({ done: 0, total: totalTargetCount });
        let done = 0;
        const failures = [];
        for (const terminal of activeTargets) {
            try {
                const response = await fetch(`/api/terminals/${encodeURIComponent(terminal.terminalId)}`, {
                    method: "DELETE",
                    headers: { Accept: "application/json" },
                });
                if (!response.ok) {
                    failures.push(`${terminal.coordinationName || terminal.label || terminal.terminalId}: ${await readDeleteFailureMessage(response, `Delete failed (${response.status})`)}`);
                }
            }
            catch (error) {
                failures.push(`${terminal.coordinationName || terminal.label || terminal.terminalId}: ${error instanceof Error ? error.message : "Delete failed."}`);
            }
            done += 1;
            setProgress({ done, total: totalTargetCount });
        }
        for (const sessionId of inactiveSessionIds) {
            try {
                const response = await fetch(`/api/conversations/${encodeURIComponent(sessionId)}`, {
                    method: "DELETE",
                    headers: { Accept: "application/json" },
                });
                if (!response.ok) {
                    failures.push(`Conversation ${sessionId}: ${await readDeleteFailureMessage(response, `Delete failed (${response.status})`)}`);
                }
            }
            catch (error) {
                failures.push(`Conversation ${sessionId}: ${error instanceof Error ? error.message : "Delete failed."}`);
            }
            done += 1;
            setProgress({ done, total: totalTargetCount });
        }
        setIsDeleting(false);
        setProgress(null);
        setFailureMessages(failures);
        onDeleted({ hadFailures: failures.length > 0 });
    }, [activeTargets, inactiveSessionIds, totalTargetCount, onDeleted]);
    return (_jsxs("section", { "aria-label": "Delete all terminals", className: "delete-confirm-dialog", onKeyDown: (event) => {
            if (event.key !== "Escape" || isDeleting)
                return;
            event.preventDefault();
            onCancel();
        }, tabIndex: -1, children: [_jsxs("header", { className: "delete-confirm-header", children: [_jsx("h2", { children: "Delete Terminals" }), _jsxs("div", { className: "delete-confirm-header-actions", children: [_jsx("span", { className: "pill blocked", children: "DESTRUCTIVE" }), _jsx(ActionButton, { "aria-label": "Close confirmation", className: "delete-confirm-close", disabled: isDeleting, onClick: onCancel, size: "dense", variant: "accent", children: "Close" })] })] }), _jsxs("div", { className: "delete-confirm-body", children: [_jsxs("p", { className: "delete-confirm-message", children: ["Delete", " ", _jsxs("strong", { children: [totalTargetCount, " ", totalTargetCount === 1 ? "session" : "sessions"] }), inactiveOnly ? " (inactive terminals + past sessions)" : " (all)", "."] }), _jsx("p", { className: "delete-confirm-message", children: "Worktree-backed terminals also remove their local worktree directories and branches." }), failureMessages.length > 0 && (_jsxs("p", { className: "delete-confirm-message", role: "alert", children: ["Failed to delete ", failureMessages.length, " ", failureMessages.length === 1 ? "item" : "items", ":", " ", failureMessages.slice(0, 3).join("; ")] })), _jsxs("div", { className: "delete-all-mode-row", children: [_jsx("span", { className: "delete-all-mode-label", children: inactiveOnly ? "Inactive only" : "All terminals" }), _jsx("button", { type: "button", className: "delete-all-toggle-switch", role: "switch", "aria-checked": !inactiveOnly, "aria-label": "Toggle between inactive only and all terminals", disabled: isDeleting, onClick: () => setInactiveOnly((prev) => !prev), children: _jsx("span", { className: "delete-all-toggle-thumb" }) })] }), _jsxs("dl", { className: "delete-confirm-details delete-all-details", children: [_jsxs("div", { children: [_jsx("dt", { children: "Inactive" }), _jsx("dd", { children: inactiveTerminals.length })] }), _jsxs("div", { children: [_jsx("dt", { children: "Past sessions" }), _jsx("dd", { children: inactiveSessionIds.length })] }), _jsxs("div", { children: [_jsx("dt", { children: "Total" }), _jsx("dd", { children: columns.length })] })] }), progress && (_jsxs("div", { className: "delete-all-progress", children: ["Deleting... ", progress.done, "/", progress.total] }))] }), _jsxs("div", { className: "delete-confirm-actions", children: [_jsx(ActionButton, { "aria-label": "Cancel delete all", className: "delete-confirm-cancel", disabled: isDeleting, onClick: onCancel, size: "dense", variant: "accent", children: "Cancel" }), _jsx(ActionButton, { "aria-label": "Confirm delete all terminals", className: "delete-confirm-submit", disabled: isDeleting || totalTargetCount === 0, onClick: () => void handleConfirm(), size: "dense", variant: "danger", children: isDeleting
                            ? `Deleting ${progress?.done ?? 0}/${progress?.total ?? 0}`
                            : `Delete ${totalTargetCount}` })] })] }));
};
