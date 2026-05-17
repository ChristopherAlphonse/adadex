import { Terminal, X } from "lucide-react";
import { type Ref, useCallback, useMemo, useState } from "react";

import type { CoordinationWorkspaceMode, DeckCoordinationSummary } from "@adadex/core";
import type { GraphNode } from "../../app/canvas/types";
import type { ConversationSessionSummary } from "../../app/types";
import {
  buildDeckTodoAddUrl,
  buildDeckTodoDeleteUrl,
  buildDeckTodoEditUrl,
  buildDeckTodoSolveUrl,
  buildDeckTodoToggleUrl,
} from "../../runtime/runtimeEndpoints";
import { MascotGlyph } from "../MascotSprite";
import { deriveMascotVisuals } from "../deck/mascotVisuals";

type CanvasOrchestrationPanelProps = {
  node: GraphNode;
  isFocused?: boolean;
  onClose: () => void;
  onFocus?: () => void;
  panelRef?: Ref<HTMLDivElement> | undefined;
  orchestration: DeckCoordinationSummary | null;
  sessions: ConversationSessionSummary[];
  onCreateAgent?: ((coordinationId: string) => void) | undefined;
  onSolveTodoItem?: ((coordinationId: string, itemIndex: number) => void) | undefined;
  onSpawnSwarm?:
    | ((coordinationId: string, workspaceMode: CoordinationWorkspaceMode) => Promise<void> | void)
    | undefined;
  onNavigateToConversation?: ((sessionId: string) => void) | undefined;
  onRefreshOrchestrationData?: (() => Promise<void>) | undefined;
};

const STATUS_LABELS: Record<string, string> = {
  idle: "idle",
  active: "active",
  blocked: "blocked",
  "needs-review": "review",
};

const formatTime = (isoString: string | null): string => {
  if (!isoString) return "—";
  const d = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
};

export const CanvasOrchestrationPanel = ({
  node,
  isFocused,
  onClose,
  onFocus,
  panelRef,
  orchestration,
  sessions,
  onCreateAgent,
  onSolveTodoItem,
  onSpawnSwarm,
  onNavigateToConversation,
  onRefreshOrchestrationData,
}: CanvasOrchestrationPanelProps) => {
  const visuals = useMemo(
    () => (orchestration ? deriveMascotVisuals(orchestration) : null),
    [orchestration],
  );
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [addingTodo, setAddingTodo] = useState(false);
  const [addText, setAddText] = useState("");
  const [solvingTodoIndex, setSolvingTodoIndex] = useState<number | null>(null);
  const [spawningSwarmMode, setSpawningSwarmMode] = useState<CoordinationWorkspaceMode | null>(
    null,
  );
  const [spawnSwarmError, setSpawnSwarmError] = useState<string | null>(null);
  const refreshOrchestrationData = useCallback(async () => {
    await onRefreshOrchestrationData?.();
  }, [onRefreshOrchestrationData]);

  const handleSpawnSwarm = useCallback(
    async (workspaceMode: CoordinationWorkspaceMode) => {
      try {
        setSpawnSwarmError(null);
        setSpawningSwarmMode(workspaceMode);
        await onSpawnSwarm?.(node.coordinationId, workspaceMode);
      } catch (error) {
        setSpawnSwarmError(error instanceof Error ? error.message : "Failed to spawn swarm.");
      } finally {
        setSpawningSwarmMode((current) => (current === workspaceMode ? null : current));
      }
    },
    [node.coordinationId, onSpawnSwarm],
  );

  const handleTodoToggle = useCallback(
    async (itemIndex: number, done: boolean) => {
      try {
        const response = await fetch(buildDeckTodoToggleUrl(node.coordinationId), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemIndex, done }),
        });
        if (!response.ok) return;
        await refreshOrchestrationData();
      } catch {
        // silent
      }
    },
    [node.coordinationId, refreshOrchestrationData],
  );

  const handleTodoEdit = useCallback(
    async (itemIndex: number, text: string) => {
      if (text.trim().length === 0) return;
      try {
        const response = await fetch(buildDeckTodoEditUrl(node.coordinationId), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemIndex, text: text.trim() }),
        });
        if (!response.ok) return;
        setEditingIndex(null);
        await refreshOrchestrationData();
      } catch {
        // silent
      }
    },
    [node.coordinationId, refreshOrchestrationData],
  );

  const handleTodoAdd = useCallback(
    async (text: string) => {
      if (text.trim().length === 0) return;
      try {
        const response = await fetch(buildDeckTodoAddUrl(node.coordinationId), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.trim() }),
        });
        if (!response.ok) return;
        setAddingTodo(false);
        setAddText("");
        await refreshOrchestrationData();
      } catch {
        // silent
      }
    },
    [node.coordinationId, refreshOrchestrationData],
  );

  const handleTodoDelete = useCallback(
    async (itemIndex: number) => {
      try {
        const response = await fetch(buildDeckTodoDeleteUrl(node.coordinationId), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemIndex }),
        });
        if (!response.ok) return;
        await refreshOrchestrationData();
      } catch {
        // silent
      }
    },
    [node.coordinationId, refreshOrchestrationData],
  );

  const handleTodoSolve = useCallback(
    async (itemIndex: number) => {
      try {
        setSolvingTodoIndex(itemIndex);
        const response = await fetch(buildDeckTodoSolveUrl(node.coordinationId), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemIndex }),
        });
        if (!response.ok) return;
        onSolveTodoItem?.(node.coordinationId, itemIndex);
      } catch {
        // silent
      } finally {
        setSolvingTodoIndex((current) => (current === itemIndex ? null : current));
      }
    },
    [node.coordinationId, onSolveTodoItem],
  );

  const progressPct =
    orchestration && orchestration.todoTotal > 0
      ? Math.round((orchestration.todoDone / orchestration.todoTotal) * 100)
      : 0;

  return (
    <div
      ref={panelRef}
      className={`detail-panel${isFocused ? " detail-panel--focused" : ""}`}
      tabIndex={-1}
      onPointerDown={() => onFocus?.()}
    >
      {/* Header */}
      <div
        className="detail-panel-header"
        style={{
          background: `linear-gradient(180deg, color-mix(in srgb, ${node.color ?? "var(--accent-primary)"} 90%, #ffd89d 10%) 0%, color-mix(in srgb, ${node.color ?? "var(--accent-primary)"} 78%, #d9851c 22%) 100%)`,
        }}
      >
        <span className="detail-title">{orchestration?.displayName ?? node.label}</span>
        {orchestration && (
          <span className="detail-type-badge">
            {STATUS_LABELS[orchestration.status] ?? orchestration.status}
          </span>
        )}
        <button className="detail-close" type="button" onClick={onClose} aria-label="Close panel">
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="detail-content">
        {/* Identity: glyph + info side by side */}
        <div className="detail-identity">
          {visuals && (
            <div className="detail-glyph">
              <MascotGlyph
                color={visuals.color}
                animation={visuals.animation}
                expression={visuals.expression}
                accessory={visuals.accessory}
                variant={visuals.variant}
                identitySeed={visuals.identitySeed}
                {...(visuals.hairColor ? { hairColor: visuals.hairColor } : {})}
                scale={6}
              />
            </div>
          )}
          <div className="detail-identity-info">
            <div className="detail-name">{orchestration?.displayName ?? node.label}</div>
            <div className="detail-row">
              <span className="detail-label">ID</span>
              <span className="detail-value detail-value--mono">{node.coordinationId}</span>
            </div>
            {orchestration?.description && (
              <div className="detail-row">
                <span className="detail-label">Description</span>
                <span className="detail-value">{orchestration.description}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions section */}
        <div className="detail-section">
          <div className="detail-section-title">Actions</div>
          <div className="detail-actions">
            <button
              type="button"
              className="detail-action-btn"
              onClick={() => onCreateAgent?.(node.coordinationId)}
            >
              &gt;_ Create Agent
            </button>
            <button
              type="button"
              className="detail-action-btn"
              disabled={spawningSwarmMode !== null}
              onClick={() => void handleSpawnSwarm("worktree")}
            >
              {spawningSwarmMode === "worktree" ? "Spawning..." : "\u2263 Spawn Swarm (Worktrees)"}
            </button>
            <button
              type="button"
              className="detail-action-btn"
              disabled={spawningSwarmMode !== null}
              onClick={() => void handleSpawnSwarm("shared")}
            >
              {spawningSwarmMode === "shared" ? "Spawning..." : "\u2263 Spawn Swarm (Normal)"}
            </button>
          </div>
          {spawnSwarmError ? <div className="deck-add-form-error">{spawnSwarmError}</div> : null}
        </div>

        {/* Progress section */}
        {orchestration && (
          <div className="detail-section">
            <div className="detail-section-title">Progress</div>
            {orchestration.todoTotal > 0 && (
              <div className="detail-progress">
                <div className="detail-progress-bar">
                  <div
                    className="detail-progress-fill"
                    style={{ width: `${progressPct}%`, backgroundColor: node.color }}
                  />
                </div>
                <span className="detail-progress-label">
                  {orchestration.todoDone}/{orchestration.todoTotal}
                </span>
              </div>
            )}
            {orchestration.todoItems.length > 0 && (
              <ul className="detail-todos">
                {orchestration.todoItems.map((item, i) => (
                  <li
                    key={`${i}-${item.text}`}
                    className={`detail-todo${item.done ? " detail-todo--done" : ""}`}
                  >
                    <div className="detail-todo-controls">
                      <button
                        type="button"
                        className="detail-todo-delete"
                        title="Delete item"
                        onClick={() => void handleTodoDelete(i)}
                      >
                        <X size={12} />
                      </button>
                      <button
                        type="button"
                        className="detail-todo-solve"
                        aria-label={`Spawn agent for todo item: ${item.text}`}
                        title="Spawn agent for this item"
                        disabled={item.done || solvingTodoIndex === i}
                        onClick={() => void handleTodoSolve(i)}
                      >
                        {solvingTodoIndex === i ? "…" : <Terminal size={15} strokeWidth={2.4} />}
                      </button>
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => handleTodoToggle(i, !item.done)}
                      />
                    </div>
                    {editingIndex === i ? (
                      <input
                        className="detail-todo-edit-input"
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleTodoEdit(i, editText);
                          if (e.key === "Escape") setEditingIndex(null);
                        }}
                        onBlur={() => void handleTodoEdit(i, editText)}
                      />
                    ) : (
                      <span
                        className="detail-todo-text"
                        onDoubleClick={() => {
                          setEditingIndex(i);
                          setEditText(item.text);
                        }}
                      >
                        {item.text}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {addingTodo ? (
              <div className="detail-todo-add-row">
                <input
                  className="detail-todo-edit-input"
                  type="text"
                  placeholder="New todo item…"
                  value={addText}
                  onChange={(e) => setAddText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleTodoAdd(addText);
                    if (e.key === "Escape") {
                      setAddingTodo(false);
                      setAddText("");
                    }
                  }}
                  onBlur={() => {
                    if (addText.trim().length > 0) {
                      void handleTodoAdd(addText);
                    } else {
                      setAddingTodo(false);
                      setAddText("");
                    }
                  }}
                />
              </div>
            ) : (
              <button
                type="button"
                className="detail-todo-add-btn"
                onClick={() => setAddingTodo(true)}
              >
                + Add item
              </button>
            )}
          </div>
        )}

        {/* Vault files */}
        {orchestration && orchestration.vaultFiles.length > 0 && (
          <div className="detail-section">
            <div className="detail-section-title">Vault Files</div>
            <div className="detail-labels-list">
              {orchestration.vaultFiles.map((file) => (
                <span key={file} className="detail-label-tag">
                  {file}
                </span>
              ))}
            </div>
          </div>
        )}

        {orchestration && orchestration.suggestedSkills.length > 0 && (
          <div className="detail-section">
            <div className="detail-section-title">Suggested Skills</div>
            <div className="detail-labels-list">
              {orchestration.suggestedSkills.map((skill) => (
                <span key={skill} className="detail-label-tag">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Sessions section */}
        <div className="detail-section">
          <div className="detail-section-title">Sessions ({sessions.length})</div>
          {sessions.length === 0 ? (
            <div className="detail-empty">No sessions yet</div>
          ) : (
            <div className="detail-sessions">
              {sessions.map((s) => (
                <button
                  key={s.sessionId}
                  type="button"
                  className="detail-session-item"
                  onClick={() => onNavigateToConversation?.(s.sessionId)}
                >
                  <span className="detail-session-preview">
                    {s.firstUserTurnPreview
                      ? s.firstUserTurnPreview.slice(0, 60)
                      : s.sessionId.slice(0, 16)}
                  </span>
                  <span className="detail-session-meta">
                    {s.turnCount} turns · {formatTime(s.lastEventAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
