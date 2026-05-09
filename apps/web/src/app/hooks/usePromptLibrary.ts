import { useCallback, useEffect, useRef, useState } from "react";

import { buildPromptItemUrl, buildPromptsUrl } from "../../runtime/runtimeEndpoints";
import type { PromptDetail, PromptLibraryEntry } from "../types";

type UsePromptLibraryOptions = {
  enabled?: boolean;
};

type UsePromptLibraryResult = {
  prompts: PromptLibraryEntry[];
  selectedPromptName: string | null;
  selectedPromptDetail: PromptDetail | null;
  isLoadingPrompts: boolean;
  isLoadingDetail: boolean;
  isEditing: boolean;
  editDraft: string;
  errorMessage: string | null;
  refreshPrompts: () => Promise<void>;
  selectPrompt: (name: string) => void;
  savePrompt: (name: string, content: string) => Promise<boolean>;
  deletePrompt: (name: string) => Promise<boolean>;
  startEditing: () => void;
  cancelEditing: () => void;
  setEditDraft: (draft: string) => void;
  submitEdit: () => Promise<boolean>;
};

export const usePromptLibrary = ({
  enabled = true,
}: UsePromptLibraryOptions = {}): UsePromptLibraryResult => {
  const [prompts, setPrompts] = useState<PromptLibraryEntry[]>([]);
  const [selectedPromptName, setSelectedPromptName] = useState<string | null>(null);
  const [selectedPromptDetail, setSelectedPromptDetail] = useState<PromptDetail | null>(null);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const detailRequestRef = useRef(0);

  const refreshPrompts = useCallback(async () => {
    setIsLoadingPrompts(true);
    setErrorMessage(null);
    try {
      const res = await fetch(buildPromptsUrl());
      if (!res.ok) throw new Error("Failed to load prompts");
      const data = (await res.json()) as { prompts: PromptLibraryEntry[] };
      setPrompts(data.prompts);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load prompts");
    } finally {
      setIsLoadingPrompts(false);
    }
  }, []);

  const selectPrompt = useCallback((name: string) => {
    setSelectedPromptName(name);
    setIsEditing(false);
    setIsLoadingDetail(true);
    setErrorMessage(null);

    const requestId = ++detailRequestRef.current;

    fetch(buildPromptItemUrl(name))
      .then(async (res) => {
        if (requestId !== detailRequestRef.current) return;
        if (!res.ok) throw new Error("Prompt not found");
        const data = (await res.json()) as PromptDetail;
        setSelectedPromptDetail(data);
      })
      .catch((err) => {
        if (requestId !== detailRequestRef.current) return;
        setSelectedPromptDetail(null);
        setErrorMessage(err instanceof Error ? err.message : "Failed to load prompt");
      })
      .finally(() => {
        if (requestId === detailRequestRef.current) {
          setIsLoadingDetail(false);
        }
      });
  }, []);

  const savePrompt = useCallback(
    async (name: string, content: string): Promise<boolean> => {
      setErrorMessage(null);
      try {
        const res = await fetch(buildPromptsUrl(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, content }),
        });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? "Failed to save prompt");
        }
        await refreshPrompts();
        return true;
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to save prompt");
        return false;
      }
    },
    [refreshPrompts],
  );

  const deletePrompt = useCallback(
    async (name: string): Promise<boolean> => {
      setErrorMessage(null);
      try {
        const res = await fetch(buildPromptItemUrl(name), { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete prompt");
        if (selectedPromptName === name) {
          setSelectedPromptName(null);
          setSelectedPromptDetail(null);
        }
        await refreshPrompts();
        return true;
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to delete prompt");
        return false;
      }
    },
    [refreshPrompts, selectedPromptName],
  );

  const startEditing = useCallback(() => {
    if (selectedPromptDetail) {
      setEditDraft(selectedPromptDetail.content);
      setIsEditing(true);
    }
  }, [selectedPromptDetail]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditDraft("");
  }, []);

  const submitEdit = useCallback(async (): Promise<boolean> => {
    if (!selectedPromptName) return false;
    setErrorMessage(null);
    try {
      const res = await fetch(buildPromptItemUrl(selectedPromptName), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editDraft }),
      });
      if (!res.ok) throw new Error("Failed to update prompt");
      const data = (await res.json()) as PromptDetail;
      setSelectedPromptDetail(data);
      setIsEditing(false);
      setEditDraft("");
      await refreshPrompts();
      return true;
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to update prompt");
      return false;
    }
  }, [selectedPromptName, editDraft, refreshPrompts]);

  useEffect(() => {
    if (enabled) {
      void refreshPrompts();
    }
  }, [enabled, refreshPrompts]);

  return {
    prompts,
    selectedPromptName,
    selectedPromptDetail,
    isLoadingPrompts,
    isLoadingDetail,
    isEditing,
    editDraft,
    errorMessage,
    refreshPrompts,
    selectPrompt,
    savePrompt,
    deletePrompt,
    startEditing,
    cancelEditing,
    setEditDraft,
    submitEdit,
  };
};
