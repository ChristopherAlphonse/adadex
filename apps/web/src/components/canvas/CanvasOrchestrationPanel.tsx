import type {
  CoordinationWorkspaceMode,
  DeckCoordinationStatus,
  DeckCoordinationSummary,
} from "@adadex/core";
import { Terminal, Trash2, X } from "lucide-react";
import { type Ref, useCallback, useMemo, useState } from "react";

import type { GraphNode } from "../../app/canvas/types";
import type { ConversationSessionSummary } from "../../app/types";
import {
  buildDeckTodoAddUrl,
  buildDeckTodoDeleteUrl,
  buildDeckTodoEditUrl,
  buildDeckTodoSolveUrl,
  buildDeckTodoToggleUrl,
} from "../../runtime/runtimeEndpoints";
import { CuteMascot } from "../deck/CuteMascot";
import { deriveMascotVisuals, mascotStateForExpression } from "../deck/mascotVisuals";

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
  onDeckLeadAction?: ((action: string) => void) | undefined;
  onAskDeckLeadToSwarm?:
    | ((coordinationId: string, coordinationName: string, openTodoCount: number) => void)
    | undefined;
  onNavigateToConversation?: ((sessionId: string) => void) | undefined;
  onRefreshOrchestrationData?: (() => Promise<void>) | undefined;
};

const DECK_LEAD_ACTIONS = [
  {
    action: "deck-lead-reorganize-todos",
    label: "Reorganize to-dos",
    description: "Review every coordination's todos and propose moves, merges and priorities.",
  },
  {
    action: "deck-lead-reorganize-coordinations",
    label: "Reorganize coordinations",
    description: "Review the coordination structure and propose keeps, merges and drops.",
  },
  {
    action: "deck-lead-clean-contexts",
    label: "Clean coordination contexts",
    description: "Find stale or redundant context files and propose fixes.",
  },
] as const;

const STATUS_LABELS = {
  idle: "idle",
  active: "active",
  blocked: "blocked",
  "needs-review": "review",
} satisfies Record<DeckCoordinationStatus, string>;

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
  onDeckLeadAction,
  onAskDeckLeadToSwarm,
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
      } catch {}
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
      } catch {}
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
      } catch {}
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
      } catch {}
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

  const openTodoCount = orchestration ? orchestration.todoTotal - orchestration.todoDone : 0;

  const swarmHint =
    openTodoCount === 0
      ? "Nothing to spawn: this coordination has no open todos."
      : `Spawns up to ${openTodoCount} worker${openTodoCount === 1 ? "" : "s"}, one per open todo.`;

  return (
    <div
      ref={panelRef}
      className={`detail-panel${isFocused ? " detail-panel--focused" : ""}`}
      tabIndex={-1}
      onPointerDown={() => onFocus?.()}
    >
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

      <div className="detail-content">
        <div className="detail-identity">
          {visuals && (
            <div className="detail-glyph">
              <CuteMascot
                color={visuals.color}
                size={96}
                state={mascotStateForExpression(visuals.expression)}
                title={`${orchestration?.displayName ?? node.label} mascot`}
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

        <div className="detail-section">
          <div className="detail-section-title">Actions</div>
          {node.type === "deck-lead" ? (
            <div className="grid gap-2">
              {DECK_LEAD_ACTIONS.map((item) => (
                <button
                  className="detail-action-btn flex-col items-start gap-0.5 text-left"
                  key={item.action}
                  onClick={() => onDeckLeadAction?.(item.action)}
                  type="button"
                >
                  <span className="font-medium">{item.label}</span>
                  <span className="text-[11px] font-normal text-muted-foreground">
                    {item.description}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="detail-actions">
                <button
                  type="button"
                  className="detail-action-btn"
                  onClick={() => onCreateAgent?.(node.coordinationId)}
                  title="Open a new agent in this coordination"
                >
                  &gt;_ Create Agent
                </button>
                <button
                  type="button"
                  className="detail-action-btn"
                  disabled={spawningSwarmMode !== null || openTodoCount === 0}
                  onClick={() => void handleSpawnSwarm("worktree")}
                  title={swarmHint}
                >
                  {spawningSwarmMode === "worktree"
                    ? "Spawning..."
                    : "\u2263 Spawn Swarm (Worktrees)"}
                </button>
                <button
                  type="button"
                  className="detail-action-btn"
                  disabled={spawningSwarmMode !== null || openTodoCount === 0}
                  onClick={() => void handleSpawnSwarm("shared")}
                  title={swarmHint}
                >
                  {spawningSwarmMode === "shared" ? "Spawning..." : "\u2263 Spawn Swarm (Normal)"}
                </button>
              </div>
              {onAskDeckLeadToSwarm ? (
                <button
                  type="button"
                  className="detail-action-btn mt-2 w-full"
                  disabled={openTodoCount === 0}
                  onClick={() =>
                    onAskDeckLeadToSwarm(
                      node.coordinationId,
                      orchestration?.displayName ?? node.label,
                      openTodoCount,
                    )
                  }
                  title="The Deck lead picks the todos and workspace mode, then asks you to confirm"
                >
                  Ask Deck lead to plan a swarm
                </button>
              ) : null}
              <p className="m-0 mt-1.5 text-[11px] text-muted-foreground">{swarmHint}</p>
            </>
          )}
          {spawnSwarmError ? <div className="deck-add-form-error">{spawnSwarmError}</div> : null}
        </div>

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
                    key={item.text}
                    className={`detail-todo group/todo${item.done ? " detail-todo--done" : ""}`}
                  >
                    <div className="detail-todo-controls">
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
                    <span className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/todo:opacity-100">
                      <button
                        type="button"
                        aria-label={`Spawn agent for todo item: ${item.text}`}
                        title="Spawn an agent to work on this item"
                        className="inline-flex h-6 items-center gap-1 rounded-md bg-secondary px-2 text-[11px] font-medium text-foreground hover:bg-accent disabled:opacity-40"
                        disabled={item.done || solvingTodoIndex === i}
                        onClick={() => void handleTodoSolve(i)}
                      >
                        {solvingTodoIndex === i ? (
                          "Starting…"
                        ) : (
                          <>
                            <Terminal size={11} strokeWidth={2.4} />
                            Solve
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        aria-label="Delete item"
                        title="Delete item"
                        className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-destructive"
                        onClick={() => void handleTodoDelete(i)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </span>
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
