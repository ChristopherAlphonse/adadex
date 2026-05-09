import { useMemo } from "react";

import type { PromptLibraryEntry } from "../app/types";

type SidebarPromptsListProps = {
  prompts: PromptLibraryEntry[];
  selectedPromptName: string | null;
  isLoadingPrompts: boolean;
  onSelectPrompt: (name: string) => void;
  onRefresh: () => void;
  onNewPrompt: () => void;
  activeTerminalId: string | null;
  onRestoreTerminal: () => void;
  onCloseTerminal: () => void;
};

export const SidebarPromptsList = ({
  prompts,
  selectedPromptName,
  isLoadingPrompts,
  onSelectPrompt,
  onRefresh,
  onNewPrompt,
  activeTerminalId,
  onRestoreTerminal,
  onCloseTerminal,
}: SidebarPromptsListProps) => {
  const userPrompts = useMemo(() => prompts.filter((p) => p.source === "user"), [prompts]);
  const builtinPrompts = useMemo(() => prompts.filter((p) => p.source === "builtin"), [prompts]);

  return (
    <div className="sidebar-prompts">
      <div className="sidebar-prompts-toolbar">
        <button type="button" className="sidebar-prompts-new-btn" onClick={onNewPrompt}>
          + New Prompt
        </button>
        <button
          type="button"
          className="sidebar-prompts-refresh-btn"
          onClick={onRefresh}
          disabled={isLoadingPrompts}
          aria-label="Refresh prompts"
        >
          ↻
        </button>
      </div>

      {isLoadingPrompts && prompts.length === 0 ? (
        <p className="sidebar-prompts-empty">Loading...</p>
      ) : prompts.length === 0 ? (
        <p className="sidebar-prompts-empty">No prompts yet</p>
      ) : (
        <div className="sidebar-prompts-list">
          {userPrompts.length > 0 && (
            <div className="sidebar-prompts-group">
              <h4 className="sidebar-prompts-group-label">My Prompts</h4>
              {userPrompts.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  className="sidebar-prompts-item"
                  data-active={selectedPromptName === p.name ? "true" : undefined}
                  onClick={() => {
                    onSelectPrompt(p.name);
                  }}
                >
                  {p.name}.md
                </button>
              ))}
            </div>
          )}

          {builtinPrompts.length > 0 && (
            <div className="sidebar-prompts-group">
              <h4 className="sidebar-prompts-group-label">Built-in</h4>
              {builtinPrompts.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  className="sidebar-prompts-item"
                  data-active={selectedPromptName === p.name ? "true" : undefined}
                  onClick={() => {
                    onSelectPrompt(p.name);
                  }}
                >
                  {p.name}.md
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTerminalId && (
        <div className="sidebar-prompts-minimized-terminal">
          <button
            type="button"
            className="sidebar-prompts-minimized-terminal-restore"
            onClick={onRestoreTerminal}
          >
            <span className="sidebar-prompts-minimized-terminal-icon">{">_"}</span>
            <span className="sidebar-prompts-minimized-terminal-label">Prompt Engineer</span>
          </button>
          <button
            type="button"
            className="sidebar-prompts-minimized-terminal-close"
            onClick={onCloseTerminal}
            aria-label="Close terminal"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
