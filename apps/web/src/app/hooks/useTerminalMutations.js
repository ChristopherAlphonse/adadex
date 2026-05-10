import { useCallback, useRef, useState } from "react";
export const useTerminalMutations = ({ readColumns, setColumns, setLoadError, setMinimizedTerminalIds, }) => {
    const [editingTerminalId, setEditingTerminalId] = useState(null);
    const [terminalNameDraft, setTerminalNameDraft] = useState("");
    const [isCreatingTerminal, setIsCreatingTerminal] = useState(false);
    const [isDeletingTerminalId, setIsDeletingTerminalId] = useState(null);
    const [pendingDeleteTerminal, setPendingDeleteTerminal] = useState(null);
    const cancelTerminalNameSubmitRef = useRef(false);
    const beginTerminalNameEdit = useCallback((terminalId, currentTerminalName) => {
        setLoadError(null);
        setEditingTerminalId(terminalId);
        setTerminalNameDraft(currentTerminalName);
    }, [setLoadError]);
    const submitTerminalRename = useCallback(async (terminalId, currentTerminalName) => {
        if (cancelTerminalNameSubmitRef.current) {
            cancelTerminalNameSubmitRef.current = false;
            return;
        }
        const trimmedName = terminalNameDraft.trim();
        if (trimmedName.length === 0) {
            setLoadError("Terminal name cannot be empty.");
            return;
        }
        if (trimmedName === currentTerminalName) {
            setEditingTerminalId(null);
            return;
        }
        try {
            setLoadError(null);
            const encodedTerminalId = encodeURIComponent(terminalId);
            const response = await fetch(`/api/terminals/${encodedTerminalId}`, {
                method: "PATCH",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ name: trimmedName }),
            });
            if (!response.ok) {
                throw new Error(`Unable to rename terminal (${response.status})`);
            }
            const nextColumns = await readColumns();
            setColumns(nextColumns);
            setEditingTerminalId(null);
        }
        catch {
            setLoadError("Unable to rename terminal.");
        }
    }, [readColumns, setColumns, setLoadError, terminalNameDraft]);
    const createTerminal = useCallback(async (workspaceMode, agentProvider, coordinationId) => {
        try {
            setIsCreatingTerminal(true);
            setLoadError(null);
            const response = await fetch("/api/terminals", {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    workspaceMode,
                    agentProvider: agentProvider ?? "codex",
                    ...(coordinationId ? { coordinationId } : {}),
                }),
            });
            if (!response.ok) {
                throw new Error(`Unable to create terminal (${response.status})`);
            }
            const createdSnapshot = (await response.json());
            const nextColumns = await readColumns();
            setColumns(nextColumns);
            const createdTerminalId = typeof createdSnapshot.terminalId === "string" ? createdSnapshot.terminalId : null;
            if (!createdTerminalId) {
                return undefined;
            }
            const createdEntry = nextColumns.find((entry) => entry.terminalId === createdTerminalId);
            const createdTerminalName = createdEntry?.coordinationName ??
                (typeof createdSnapshot.coordinationName === "string"
                    ? createdSnapshot.coordinationName
                    : createdTerminalId);
            setMinimizedTerminalIds((current) => current.filter((id) => id !== createdTerminalId));
            beginTerminalNameEdit(createdTerminalId, createdTerminalName);
            return createdTerminalId;
        }
        catch {
            setLoadError("Unable to create a new terminal.");
            return undefined;
        }
        finally {
            setIsCreatingTerminal(false);
        }
    }, [beginTerminalNameEdit, readColumns, setColumns, setLoadError, setMinimizedTerminalIds]);
    const requestDeleteTerminal = useCallback((terminalId, terminalName, options) => {
        setLoadError(null);
        setPendingDeleteTerminal({
            terminalId,
            coordinationName: terminalName,
            workspaceMode: options?.workspaceMode ?? "shared",
            intent: options?.intent ?? "delete-terminal",
        });
    }, [setLoadError]);
    const closeTerminal = useCallback(async (terminalId) => {
        try {
            setLoadError(null);
            setIsDeletingTerminalId(terminalId);
            const encodedTerminalId = encodeURIComponent(terminalId);
            const response = await fetch(`/api/terminals/${encodedTerminalId}`, {
                method: "DELETE",
                headers: {
                    Accept: "application/json",
                },
            });
            if (!response.ok) {
                throw new Error(`Unable to delete terminal (${response.status})`);
            }
            if (editingTerminalId === terminalId) {
                setEditingTerminalId(null);
                setTerminalNameDraft("");
            }
            setMinimizedTerminalIds((current) => current.filter((currentTerminalId) => currentTerminalId !== terminalId));
            const nextColumns = await readColumns();
            setColumns(nextColumns);
            return true;
        }
        catch {
            setLoadError("Unable to delete terminal.");
            return false;
        }
        finally {
            setIsDeletingTerminalId(null);
        }
    }, [editingTerminalId, readColumns, setColumns, setLoadError, setMinimizedTerminalIds]);
    const confirmDeleteTerminal = useCallback(async () => {
        if (!pendingDeleteTerminal) {
            return;
        }
        const didClose = await closeTerminal(pendingDeleteTerminal.terminalId);
        if (didClose) {
            setPendingDeleteTerminal(null);
        }
    }, [closeTerminal, pendingDeleteTerminal]);
    const clearPendingDeleteTerminal = useCallback(() => {
        setPendingDeleteTerminal(null);
    }, []);
    const cancelTerminalRename = useCallback(() => {
        cancelTerminalNameSubmitRef.current = true;
        setEditingTerminalId(null);
        setTerminalNameDraft("");
    }, []);
    return {
        editingTerminalId,
        terminalNameDraft,
        isCreatingTerminal,
        isDeletingTerminalId,
        pendingDeleteTerminal,
        setTerminalNameDraft,
        setEditingTerminalId,
        beginTerminalNameEdit,
        submitTerminalRename,
        createTerminal,
        requestDeleteTerminal,
        closeTerminal,
        confirmDeleteTerminal,
        clearPendingDeleteTerminal,
        cancelTerminalRename,
    };
};
