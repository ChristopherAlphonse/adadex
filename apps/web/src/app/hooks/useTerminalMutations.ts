import type { Dispatch, SetStateAction } from "react";
import { useCallback, useRef, useState } from "react";

import type { TerminalAgentProvider, TerminalView, TerminalWorkspaceMode } from "../types";

export type PendingDeleteTerminal = {
  terminalId: string;
  coordinationName: string;
  workspaceMode: TerminalWorkspaceMode;
  intent: "close-terminal" | "delete-terminal" | "cleanup-worktree";
};

type UseTerminalMutationsOptions = {
  readColumns: () => Promise<TerminalView>;
  setColumns: Dispatch<SetStateAction<TerminalView>>;
  setLoadError: Dispatch<SetStateAction<string | null>>;
  setMinimizedTerminalIds: Dispatch<SetStateAction<string[]>>;
};

type UseTerminalMutationsResult = {
  editingTerminalId: string | null;
  terminalNameDraft: string;
  isCreatingTerminal: boolean;
  isDeletingTerminalId: string | null;
  pendingDeleteTerminal: PendingDeleteTerminal | null;
  setTerminalNameDraft: Dispatch<SetStateAction<string>>;
  setEditingTerminalId: Dispatch<SetStateAction<string | null>>;
  beginTerminalNameEdit: (terminalId: string, currentTerminalName: string) => void;
  submitTerminalRename: (terminalId: string, currentTerminalName: string) => Promise<void>;
  createTerminal: (
    workspaceMode: TerminalWorkspaceMode,
    agentProvider?: TerminalAgentProvider,
    coordinationId?: string,
  ) => Promise<string | undefined>;
  requestDeleteTerminal: (
    terminalId: string,
    terminalName: string,
    options?: {
      workspaceMode?: TerminalWorkspaceMode;
      intent?: "close-terminal" | "delete-terminal" | "cleanup-worktree";
    },
  ) => void;
  closeTerminal: (terminalId: string) => Promise<boolean>;
  confirmDeleteTerminal: () => Promise<void>;
  clearPendingDeleteTerminal: () => void;
  cancelTerminalRename: () => void;
};

export const useTerminalMutations = ({
  readColumns,
  setColumns,
  setLoadError,
  setMinimizedTerminalIds,
}: UseTerminalMutationsOptions): UseTerminalMutationsResult => {
  const [editingTerminalId, setEditingTerminalId] = useState<string | null>(null);
  const [terminalNameDraft, setTerminalNameDraft] = useState("");
  const [isCreatingTerminal, setIsCreatingTerminal] = useState(false);
  const [isDeletingTerminalId, setIsDeletingTerminalId] = useState<string | null>(null);
  const [pendingDeleteTerminal, setPendingDeleteTerminal] = useState<PendingDeleteTerminal | null>(
    null,
  );
  const cancelTerminalNameSubmitRef = useRef(false);

  const beginTerminalNameEdit = useCallback(
    (terminalId: string, currentTerminalName: string) => {
      setLoadError(null);
      setEditingTerminalId(terminalId);
      setTerminalNameDraft(currentTerminalName);
    },
    [setLoadError],
  );

  const submitTerminalRename = useCallback(
    async (terminalId: string, currentTerminalName: string) => {
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
      } catch {
        setLoadError("Unable to rename terminal.");
      }
    },
    [readColumns, setColumns, setLoadError, terminalNameDraft],
  );

  const createTerminal = useCallback(
    async (
      workspaceMode: TerminalWorkspaceMode,
      agentProvider?: TerminalAgentProvider,
      coordinationId?: string,
    ) => {
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

        const createdSnapshot = (await response.json()) as {
          terminalId?: unknown;
          coordinationName?: unknown;
        };
        const nextColumns = await readColumns();
        setColumns(nextColumns);

        const createdTerminalId =
          typeof createdSnapshot.terminalId === "string" ? createdSnapshot.terminalId : null;
        if (!createdTerminalId) {
          return undefined;
        }

        const createdEntry = nextColumns.find((entry) => entry.terminalId === createdTerminalId);
        const createdTerminalName =
          createdEntry?.coordinationName ??
          (typeof createdSnapshot.coordinationName === "string"
            ? createdSnapshot.coordinationName
            : createdTerminalId);
        setMinimizedTerminalIds((current) => current.filter((id) => id !== createdTerminalId));
        beginTerminalNameEdit(createdTerminalId, createdTerminalName);
        return createdTerminalId;
      } catch {
        setLoadError("Unable to create a new terminal.");
        return undefined;
      } finally {
        setIsCreatingTerminal(false);
      }
    },
    [beginTerminalNameEdit, readColumns, setColumns, setLoadError, setMinimizedTerminalIds],
  );

  const requestDeleteTerminal = useCallback(
    (
      terminalId: string,
      terminalName: string,
      options?: {
        workspaceMode?: TerminalWorkspaceMode;
        intent?: "close-terminal" | "delete-terminal" | "cleanup-worktree";
      },
    ) => {
      setLoadError(null);
      setPendingDeleteTerminal({
        terminalId,
        coordinationName: terminalName,
        workspaceMode: options?.workspaceMode ?? "shared",
        intent: options?.intent ?? "delete-terminal",
      });
    },
    [setLoadError],
  );

  const closeTerminal = useCallback(
    async (terminalId: string) => {
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
        setMinimizedTerminalIds((current) =>
          current.filter((currentTerminalId) => currentTerminalId !== terminalId),
        );

        const nextColumns = await readColumns();
        setColumns(nextColumns);
        return true;
      } catch {
        setLoadError("Unable to delete terminal.");
        return false;
      } finally {
        setIsDeletingTerminalId(null);
      }
    },
    [editingTerminalId, readColumns, setColumns, setLoadError, setMinimizedTerminalIds],
  );

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
