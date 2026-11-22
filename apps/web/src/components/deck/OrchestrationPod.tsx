import type { DeckCoordinationSummary } from "@adadex/core";
import { useEffect, useRef } from "react";

import { CuteMascot, MASCOT_STATE_FOR_STATUS } from "./CuteMascot";
import type { MascotVisuals } from "./mascotVisuals";
import { renderInlineCode } from "./TodoRow";

export const STATUS_LABELS: Record<DeckCoordinationSummary["status"], string> = {
  idle: "idle",
  active: "active",
  blocked: "blocked",
  "needs-review": "review",
};

export const TodoList = ({
  items,
  coordinationId,
  onToggle,
}: {
  items: { text: string; done: boolean }[];
  coordinationId: string;
  onToggle?: ((coordinationId: string, itemIndex: number, done: boolean) => void) | undefined;
}) => {
  let lastDoneIndex = -1;

  for (let idx = items.length - 1; idx >= 0; idx--) {
    if (items[idx]?.done) {
      lastDoneIndex = idx;
      break;
    }
  }

  const scrollRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ block: "start" });
  }, []);

  return (
    <ul className="deck-pod-todos">
      {items.map((item, i) => (
        <li
          key={item.text}
          ref={i === lastDoneIndex ? scrollRef : undefined}
          className={`deck-pod-todo-item${item.done ? " deck-pod-todo-item--done" : ""}`}
        >
          <input
            type="checkbox"
            checked={item.done}
            className="deck-pod-todo-checkbox"
            onChange={() => onToggle?.(coordinationId, i, !item.done)}
          />
          <span className="deck-pod-todo-text">{item.text}</span>
        </li>
      ))}
    </ul>
  );
};

export type OrchestrationPodProps = {
  orchestration: DeckCoordinationSummary;
  visuals: MascotVisuals;
  isFocused: boolean;
  activeFileName?: string | undefined;
  onVaultFileClick?: (fileName: string) => void;
  onClose?: () => void;
  onOpen?: () => void;
  onTodoToggle?: (coordinationId: string, itemIndex: number, done: boolean) => void;
};

export const OrchestrationPod = ({
  orchestration,
  visuals,
  isFocused,
  activeFileName,
  onVaultFileClick,
  onClose,
  onOpen,
  onTodoToggle,
}: OrchestrationPodProps) => {
  const progressPct =
    orchestration.todoTotal > 0
      ? Math.round((orchestration.todoDone / orchestration.todoTotal) * 100)
      : 0;

  const nextTodo = orchestration.todoItems.find((item) => !item.done);

  return (
    <article
      className={`deck-pod${isFocused ? " deck-pod--focused" : ""}${onOpen && !isFocused ? " deck-pod--clickable" : ""}`}
      data-status={orchestration.status}
    >
      {isFocused && (
        <header className="deck-pod-header">
          <button type="button" className="deck-pod-btn deck-pod-btn--secondary" onClick={onClose}>
            ← Back
          </button>
        </header>
      )}

      <div className="deck-pod-body">
        <span className={`deck-pod-status deck-pod-status--${orchestration.status}`}>
          {STATUS_LABELS[orchestration.status]}
        </span>
        <div className="deck-pod-identity">
          <div className="deck-pod-mascot-col">
            <div className="deck-pod-mascot">
              <CuteMascot
                color={visuals.color}
                size={isFocused ? 84 : 56}
                state={MASCOT_STATE_FOR_STATUS[orchestration.status]}
              />
            </div>
          </div>
          <div className="deck-pod-identity-text">
            {onOpen && !isFocused ? (
              <button type="button" className="deck-pod-name deck-pod-open" onClick={onOpen}>
                {orchestration.displayName}
              </button>
            ) : (
              <span className="deck-pod-name">{orchestration.displayName}</span>
            )}
            <span className="deck-pod-description">{orchestration.description}</span>
          </div>
        </div>

        <div className="deck-pod-details">
          {orchestration.todoTotal > 0 && (
            <div className="deck-pod-progress">
              <div className="deck-pod-progress-bar">
                <div
                  className="deck-pod-progress-fill"
                  data-complete={progressPct >= 100 ? "true" : undefined}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="deck-pod-progress-label">
                {orchestration.todoDone} of {orchestration.todoTotal}
              </span>
            </div>
          )}

          {isFocused ? (
            <>
              {orchestration.todoItems.length > 0 && (
                <TodoList
                  items={orchestration.todoItems}
                  coordinationId={orchestration.coordinationId}
                  onToggle={onTodoToggle}
                />
              )}

              {orchestration.vaultFiles.length > 0 && (
                <div className="deck-pod-vault">
                  <span className="deck-pod-vault-label">vault</span>
                  <div className="deck-pod-vault-files">
                    {orchestration.vaultFiles.map((file) => (
                      <button
                        key={file}
                        type="button"
                        className="deck-pod-vault-file"
                        aria-current={activeFileName === file ? "true" : undefined}
                        onClick={() => {
                          onVaultFileClick?.(file);
                        }}
                      >
                        {file}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="deck-pod-next">
              {nextTodo ? (
                <>
                  <span className="deck-pod-next-label">Next</span>
                  <span className="deck-pod-next-text">{renderInlineCode(nextTodo.text)}</span>
                </>
              ) : orchestration.todoTotal > 0 ? (
                <span className="deck-pod-next-text">All todos done</span>
              ) : (
                <span className="deck-pod-next-text">No todos yet</span>
              )}
            </p>
          )}
        </div>
      </div>
    </article>
  );
};
