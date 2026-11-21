import type {
  DeckAvailableSkill,
  DeckCoordinationSummary,
  TerminalAgentProvider,
} from "@adadex/core";
import { TERMINAL_AGENT_PROVIDERS } from "@adadex/core";
import { useEffect, useRef, useState } from "react";

import { formatColorForDisplay } from "../../app/mascotPalette";
import { type AgentGlyphAccessory, type AgentGlyphMood, MascotSprite } from "../MascotSprite";
import type { MascotVisuals } from "./mascotVisuals";
import { MASCOT_COLORS } from "./mascotVisuals";

// ─── Status styling ──────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<DeckCoordinationSummary["status"], string> = {
  idle: "idle",
  active: "active",
  blocked: "blocked",
  "needs-review": "review",
};

// ─── TodoList ────────────────────────────────────────────────────────────────

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

// ─── OrchestrationPod ─────────────────────────────────────────────────────────────

export type OrchestrationPodProps = {
  orchestration: DeckCoordinationSummary;
  visuals: MascotVisuals;
  isFocused: boolean;
  activeFileName?: string | undefined;
  onVaultFileClick?: (fileName: string) => void;
  onVaultBrowse?: () => void;
  onClose?: () => void;
  onOpen?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean | undefined;
  onTodoToggle?: (coordinationId: string, itemIndex: number, done: boolean) => void;
  availableSkills: DeckAvailableSkill[];
  isSavingSkills?: boolean | undefined;
  onSaveSuggestedSkills?:
    | ((coordinationId: string, suggestedSkills: string[]) => Promise<boolean>)
    | undefined;
  onSaveMascot?:
    | ((
        coordinationId: string,
        mascot: { color: string; expression: string; accessory: string },
      ) => Promise<boolean>)
    | undefined;
  onSaveAgent?:
    | ((coordinationId: string, agentProvider: TerminalAgentProvider | null) => Promise<boolean>)
    | undefined;
};

export const OrchestrationPod = ({
  orchestration,
  visuals,
  isFocused,
  activeFileName,
  onVaultFileClick,
  onVaultBrowse,
  onClose,
  onOpen,
  onDelete,
  isDeleting,
  onTodoToggle,
  availableSkills,
  isSavingSkills,
  onSaveSuggestedSkills,
  onSaveMascot,
  onSaveAgent,
}: OrchestrationPodProps) => {
  const progressPct =
    orchestration.todoTotal > 0
      ? Math.round((orchestration.todoDone / orchestration.todoTotal) * 100)
      : 0;

  const nextTodo = orchestration.todoItems.find((item) => !item.done);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (
        menuRef.current &&
        event.target instanceof Node &&
        !menuRef.current.contains(event.target)
      ) {
        setIsMenuOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isMenuOpen]);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isEditingSkills, setIsEditingSkills] = useState(false);
  const [draftSkills, setDraftSkills] = useState<string[]>(orchestration.suggestedSkills);
  const [isEditingMascot, setIsEditingMascot] = useState(false);
  const [newSkillInput, setNewSkillInput] = useState("");
  const [editColor, setEditColor] = useState(visuals.color);
  const [editExpression, setEditExpression] = useState<AgentGlyphMood>(visuals.expression);
  const [editAccessory, setEditAccessory] = useState<AgentGlyphAccessory>(visuals.accessory);
  const [isSavingMascot, setIsSavingMascot] = useState(false);

  const [editAgentProvider, setEditAgentProvider] = useState<TerminalAgentProvider | "">(
    orchestration.agentProvider ?? "",
  );

  useEffect(() => {
    setDraftSkills(orchestration.suggestedSkills);
  }, [orchestration.suggestedSkills]);

  useEffect(() => {
    setEditAgentProvider(orchestration.agentProvider ?? "");
  }, [orchestration.agentProvider]);

  const availableSkillNames = availableSkills.map((skill) => skill.name);

  const skillNames = [...new Set([...availableSkillNames, ...draftSkills])].sort((a, b) =>
    a.localeCompare(b),
  );

  const toggleSkill = (skillName: string) => {
    setDraftSkills((current) =>
      current.includes(skillName)
        ? current.filter((skill) => skill !== skillName)
        : [...current, skillName].sort((a, b) => a.localeCompare(b)),
    );
  };

  const handleSaveSkills = async () => {
    const saved = await onSaveSuggestedSkills?.(orchestration.coordinationId, draftSkills);

    if (saved) {
      setIsEditingSkills(false);
    }
  };

  const handleSaveMascot = async () => {
    setIsSavingMascot(true);

    const [savedMascot, savedAgent] = await Promise.all([
      onSaveMascot?.(orchestration.coordinationId, {
        color: editColor,
        expression: editExpression,
        accessory: editAccessory,
      }),
      onSaveAgent?.(orchestration.coordinationId, editAgentProvider || null),
    ]);

    if (savedMascot || savedAgent) {
      setIsEditingMascot(false);
    }

    setIsSavingMascot(false);
  };

  return (
    <article
      className={`deck-pod${isFocused ? " deck-pod--focused" : ""}${onOpen && !isFocused ? " deck-pod--clickable" : ""}`}
      data-status={orchestration.status}
    >
      <header className="deck-pod-header">
        {isFocused && (
          <button type="button" className="deck-pod-btn deck-pod-btn--secondary" onClick={onClose}>
            ← Back
          </button>
        )}
        {confirmingDelete ? (
          <>
            <span className="deck-pod-confirm-text">Delete this orchestration?</span>
            <button
              type="button"
              className="deck-pod-btn deck-pod-btn--danger"
              disabled={isDeleting}
              onClick={() => onDelete?.()}
            >
              {isDeleting ? "..." : "Delete"}
            </button>
            <button
              type="button"
              className="deck-pod-btn deck-pod-btn--secondary"
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </button>
          </>
        ) : (
          <div className="deck-pod-menu" ref={menuRef}>
            <button
              type="button"
              className="deck-pod-btn deck-pod-btn--icon"
              aria-label="Orchestration actions"
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen((v) => !v)}
            >
              ⋯
            </button>
            {isMenuOpen && (
              <div className="deck-pod-menu-list" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsEditingSkills((v) => !v);
                  }}
                >
                  Skills
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setEditColor(visuals.color);
                    setEditExpression(visuals.expression);
                    setEditAccessory(visuals.accessory);
                    setIsEditingMascot(true);
                  }}
                >
                  Customize
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onVaultBrowse?.();
                  }}
                >
                  Vault
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="deck-pod-menu-danger"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setConfirmingDelete(true);
                  }}
                >
                  Delete…
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      <div className="deck-pod-body">
        <span className={`deck-pod-status deck-pod-status--${orchestration.status}`}>
          {STATUS_LABELS[orchestration.status]}
        </span>
        <div className="deck-pod-identity">
          <div className="deck-pod-mascot-col">
            <div className="deck-pod-mascot">
              <MascotSprite
                speedMs={100}
                size={isFocused ? 100 : 72}
                color={visuals.color}
                animation={visuals.animation}
                expression={visuals.expression}
                accessory={visuals.accessory}
                variant={visuals.variant}
                identitySeed={visuals.identitySeed}
                {...(visuals.hairColor ? { hairColor: visuals.hairColor } : {})}
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

        {isFocused && orchestration.agentProvider && (
          <div className="deck-pod-agent-badge">
            <span className="deck-pod-vault-label">agent</span>
            <span className="deck-pod-vault-file">{orchestration.agentProvider}</span>
          </div>
        )}

        {isEditingMascot && (
          <div className="deck-pod-mascot-editor">
            <div className="deck-pod-mascot-editor-colors">
              {MASCOT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="deck-add-form-color-swatch"
                  data-selected={c === editColor ? "true" : "false"}
                  style={{ backgroundColor: c }}
                  onClick={() => setEditColor(c)}
                  title={formatColorForDisplay(c)}
                  aria-label={`Select color ${formatColorForDisplay(c)}`}
                />
              ))}
            </div>
            <p className="deck-add-form-color-meta">{formatColorForDisplay(editColor)}</p>
            <div className="deck-pod-mascot-editor-options">
              <div className="deck-pod-mascot-editor-group">
                <span className="deck-pod-mascot-editor-label">Expression</span>
                <div className="deck-pod-mascot-editor-chips">
                  {
                    /* SAFETY: preceding checks establish the invariant this assertion encodes. */ (
                      ["neutral", "happy", "focused", "curious"] as AgentGlyphMood[]
                    ).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        className="deck-add-form-chip"
                        data-selected={opt === editExpression ? "true" : "false"}
                        onClick={() => setEditExpression(opt)}
                      >
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </button>
                    ))
                  }
                </div>
              </div>
              <div className="deck-pod-mascot-editor-group">
                <span className="deck-pod-mascot-editor-label">Accessory</span>
                <div className="deck-pod-mascot-editor-chips">
                  {
                    /* SAFETY: preceding checks establish the invariant this assertion encodes. */ (
                      [
                        { value: "none" as const, label: "None" },
                        { value: "glasses" as const, label: "Glasses" },
                        { value: "badge" as const, label: "Badge" },
                        { value: "visor" as const, label: "Visor" },
                        { value: "terminal" as const, label: "Terminal" },
                        { value: "node-ring" as const, label: "Node Ring" },
                        { value: "shield" as const, label: "Shield" },
                      ] as { value: AgentGlyphAccessory; label: string }[]
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className="deck-add-form-chip"
                        data-selected={opt.value === editAccessory ? "true" : "false"}
                        onClick={() => setEditAccessory(opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))
                  }
                </div>
              </div>
            </div>
            <div className="deck-pod-mascot-editor-group">
              <span className="deck-pod-mascot-editor-label">Agent CLI</span>
              <div className="deck-pod-mascot-editor-chips">
                <button
                  type="button"
                  className="deck-add-form-chip"
                  data-selected={editAgentProvider === "" ? "true" : "false"}
                  onClick={() => {
                    setEditAgentProvider("");
                  }}
                >
                  Global default
                </button>
                {TERMINAL_AGENT_PROVIDERS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="deck-add-form-chip"
                    data-selected={editAgentProvider === p ? "true" : "false"}
                    onClick={() => {
                      setEditAgentProvider(p);
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="deck-pod-mascot-editor-actions">
              <button
                type="button"
                className="deck-pod-btn deck-pod-btn--secondary"
                onClick={() => setIsEditingMascot(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="deck-pod-btn"
                disabled={isSavingMascot}
                onClick={() => void handleSaveMascot()}
              >
                {isSavingMascot ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        )}

        <div className="deck-pod-details">
          {isEditingSkills && (
            <div className="deck-pod-skills-editor">
              {skillNames.length === 0 ? (
                <span className="deck-pod-skills-empty">
                  No project skills found (.claude/skills, .opencode/skills, .agents/skills,
                  .kiro/skills).
                </span>
              ) : (
                <div className="deck-pod-skills-options">
                  {skillNames.map((skillName) => {
                    const skill = availableSkills.find((entry) => entry.name === skillName);

                    return (
                      <label key={skillName} className="deck-pod-skill-option">
                        <input
                          type="checkbox"
                          checked={draftSkills.includes(skillName)}
                          onChange={() => toggleSkill(skillName)}
                        />
                        <span className="deck-pod-skill-copy">
                          <span className="deck-pod-skill-name">{skillName}</span>
                          {skill?.description && (
                            <span className="deck-pod-skill-desc">{skill.description}</span>
                          )}
                          {!skill && (
                            <span className="deck-pod-skill-desc">
                              Stored on this orchestration, but not available right now.
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              <div className="deck-pod-skills-new">
                <input
                  type="text"
                  className="deck-pod-skills-new-input"
                  placeholder="New skill name…"
                  value={newSkillInput}
                  onChange={(e) => setNewSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const trimmed = newSkillInput.trim();

                      if (trimmed && !draftSkills.includes(trimmed)) {
                        setDraftSkills((current) =>
                          [...current, trimmed].sort((a, b) => a.localeCompare(b)),
                        );
                      }

                      setNewSkillInput("");
                    }
                  }}
                />
                <button
                  type="button"
                  className="deck-pod-btn"
                  onClick={() => {
                    const trimmed = newSkillInput.trim();

                    if (trimmed && !draftSkills.includes(trimmed)) {
                      setDraftSkills((current) =>
                        [...current, trimmed].sort((a, b) => a.localeCompare(b)),
                      );
                    }

                    setNewSkillInput("");
                  }}
                >
                  Add
                </button>
              </div>
              <div className="deck-pod-skills-actions">
                <button
                  type="button"
                  className="deck-pod-btn deck-pod-btn--secondary"
                  onClick={() => {
                    setDraftSkills(orchestration.suggestedSkills);
                    setIsEditingSkills(false);
                    setNewSkillInput("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="deck-pod-btn"
                  disabled={Boolean(isSavingSkills)}
                  onClick={() => void handleSaveSkills()}
                >
                  {isSavingSkills ? "Saving..." : "Save Skills"}
                </button>
              </div>
            </div>
          )}

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

              {orchestration.suggestedSkills.length > 0 && (
                <div className="deck-pod-vault">
                  <span className="deck-pod-vault-label">skills</span>
                  <div className="deck-pod-vault-files">
                    {orchestration.suggestedSkills.map((skill) => (
                      <span key={skill} className="deck-pod-vault-file">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
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
                        onClick={(e) => {
                          e.stopPropagation();
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
                  <span className="deck-pod-next-text">{nextTodo.text}</span>
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
