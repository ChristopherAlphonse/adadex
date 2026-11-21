import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { usePromptLibrary } from "../app/hooks/usePromptLibrary";
import { toPromptLabel } from "../app/promptLabel";
import { SidebarPromptsList } from "./SidebarPromptsList";
import { ActionButton } from "./ui/ActionButton";
import { MarkdownContent } from "./ui/MarkdownContent";

type PromptsPrimaryViewProps = {
  enabled: boolean;
  onSidebarContent?: (content: ReactNode) => void;
};

const toPromptSlug = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\.md$/i, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^[-.]+|-+$/g, "");

export const PromptsPrimaryView = ({ enabled, onSidebarContent }: PromptsPrimaryViewProps) => {
  const {
    prompts,
    selectedPromptName,
    selectedPromptDetail: selectedPrompt,
    isLoadingPrompts,
    isLoadingDetail,
    isEditing,
    editDraft,
    errorMessage,
    refreshPrompts,
    selectPrompt: selectPromptLibraryItem,
    savePrompt: savePromptLibraryItem,
    deletePrompt: deletePromptLibraryItem,
    startEditing: onStartEditing,
    cancelEditing: onCancelEditing,
    setEditDraft: onSetEditDraft,
    submitEdit: onSubmitEdit,
  } = usePromptLibrary({ enabled });

  const [isComposing, setIsComposing] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");
  const [isSavingNew, setIsSavingNew] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isComposing) {
      nameInputRef.current?.focus();
    }
  }, [isComposing]);

  const onDelete = useCallback(() => {
    if (selectedPromptName) {
      return deletePromptLibraryItem(selectedPromptName);
    }

    return Promise.resolve(false);
  }, [selectedPromptName, deletePromptLibraryItem]);

  const newSlug = toPromptSlug(newName);
  const slugTaken = prompts.some((p) => p.name === newSlug);
  const canSaveNew = newSlug.length > 0 && newContent.trim().length > 0 && !slugTaken;

  const onCancelNew = useCallback(() => {
    setIsComposing(false);
    setNewName("");
    setNewContent("");
  }, []);

  const onSaveNew = useCallback(async () => {
    if (!canSaveNew) {
      return;
    }

    setIsSavingNew(true);
    const ok = await savePromptLibraryItem(newSlug, newContent);

    setIsSavingNew(false);

    if (ok) {
      onCancelNew();
      selectPromptLibraryItem(newSlug);
    }
  }, [
    canSaveNew,
    newSlug,
    newContent,
    savePromptLibraryItem,
    selectPromptLibraryItem,
    onCancelNew,
  ]);

  // Push sidebar content
  const sidebarContent = (
    <SidebarPromptsList
      prompts={prompts}
      selectedPromptName={selectedPromptName}
      isLoadingPrompts={isLoadingPrompts}
      onSelectPrompt={(name) => {
        setIsComposing(false);
        selectPromptLibraryItem(name);
      }}
      onRefresh={() => {
        void refreshPrompts();
      }}
      onNewPrompt={() => {
        setIsComposing(true);
      }}
    />
  );

  useEffect(() => {
    onSidebarContent?.(sidebarContent);

    return () => onSidebarContent?.(null);
  });

  return (
    <section className="prompts-view" aria-label="Prompts primary view">
      {isComposing ? (
        <div className="prompts-detail">
          <header className="prompts-detail-header">
            <div className="prompts-detail-header-left prompts-compose-name">
              <input
                aria-label="Prompt name"
                ref={nameInputRef}
                className="prompts-compose-input"
                onChange={(e) => {
                  setNewName(e.target.value);
                }}
                placeholder="Prompt name, e.g. release notes"
                type="text"
                value={newName}
              />
              {slugTaken ? (
                <span className="prompts-compose-hint prompts-compose-hint--error">
                  A prompt with this name already exists
                </span>
              ) : newSlug.length > 0 ? (
                <span className="prompts-compose-hint">Saved as {newSlug}</span>
              ) : null}
            </div>
            <div className="prompts-detail-header-actions">
              <ActionButton onClick={onCancelNew}>Cancel</ActionButton>
              <ActionButton
                disabled={!canSaveNew || isSavingNew}
                onClick={() => {
                  void onSaveNew();
                }}
              >
                {isSavingNew ? "Saving..." : "Save"}
              </ActionButton>
            </div>
          </header>
          {errorMessage ? <p className="prompts-error">{errorMessage}</p> : null}
          <textarea
            className="prompts-edit-area"
            onChange={(e) => {
              setNewContent(e.target.value);
            }}
            placeholder="Write your prompt here. Use {{variable}} for values filled in at launch."
            spellCheck={false}
            value={newContent}
          />
        </div>
      ) : (
        <>
          {errorMessage ? <p className="prompts-error">{errorMessage}</p> : null}

          {isLoadingDetail ? (
            <p className="prompts-empty">Loading prompt...</p>
          ) : selectedPrompt ? (
            <div className="prompts-detail">
              <header className="prompts-detail-header">
                <div className="prompts-detail-header-left">
                  <h3 className="prompts-detail-name">{toPromptLabel(selectedPrompt.name)}</h3>
                  <span className="prompts-detail-source-badge" data-source={selectedPrompt.source}>
                    {selectedPrompt.source === "user" ? "User" : "Built-in"}
                  </span>
                </div>
                {selectedPrompt.source === "user" && (
                  <div className="prompts-detail-header-actions">
                    {isEditing ? (
                      <>
                        <ActionButton
                          onClick={() => {
                            void onSubmitEdit();
                          }}
                        >
                          Save
                        </ActionButton>
                        <ActionButton onClick={onCancelEditing}>Cancel</ActionButton>
                      </>
                    ) : (
                      <>
                        <ActionButton onClick={onStartEditing}>Edit</ActionButton>
                        <ActionButton
                          onClick={() => {
                            void onDelete();
                          }}
                        >
                          Delete
                        </ActionButton>
                      </>
                    )}
                  </div>
                )}
              </header>

              {isEditing ? (
                <textarea
                  className="prompts-edit-area"
                  value={editDraft}
                  onChange={(e) => {
                    onSetEditDraft(e.target.value);
                  }}
                  spellCheck={false}
                />
              ) : (
                <div className="prompts-content">
                  <MarkdownContent content={selectedPrompt.content} />
                </div>
              )}
            </div>
          ) : (
            <div className="prompts-empty-state">
              <p className="prompts-empty">
                Select a prompt from the sidebar, or create a new one.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
};
