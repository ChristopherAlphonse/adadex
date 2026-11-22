import {
  type DeckAvailableSkill,
  type DeckCoordinationSummary,
  TERMINAL_AGENT_PROVIDERS,
  type TerminalAgentProvider,
} from "@adadex/core";
import { useState } from "react";

import { formatColorForDisplay } from "../../app/mascotPalette";
import { cn } from "../../lib/utils";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { CuteMascot, type CuteMascotState, MASCOT_STATE_FOR_STATUS } from "./CuteMascot";
import type { MascotVisuals } from "./mascotVisuals";
import { MASCOT_COLORS } from "./mascotVisuals";

const STATUS_LABELS: Record<DeckCoordinationSummary["status"], string> = {
  idle: "Idle",
  active: "Active",
  blocked: "Blocked",
  "needs-review": "Needs review",
};

const STATUS_STYLES: Record<DeckCoordinationSummary["status"], string> = {
  idle: "bg-surface-2 text-muted-foreground",
  active: "bg-running/15 text-running",
  blocked: "bg-destructive/15 text-destructive",
  "needs-review": "bg-stale/15 text-stale",
};

const MOOD_OPTIONS: { value: CuteMascotState; label: string }[] = [
  { value: "sleeping", label: "Sleeping" },
  { value: "idle", label: "Awake" },
  { value: "working", label: "Working" },
  { value: "happy", label: "Happy" },
  { value: "worried", label: "Worried" },
];

const actionButtonClass =
  "inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-50";

const primaryButtonClass =
  "inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50";

const chipClass = (selected: boolean) =>
  cn(
    "inline-flex h-8 cursor-pointer items-center rounded-full border px-3 text-xs font-medium transition-colors",
    selected
      ? "border-primary bg-primary/15 text-foreground"
      : "border-border bg-surface text-muted-foreground hover:text-foreground",
  );

const SectionTitle = ({ children }: { children: string }) => (
  <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
    {children}
  </h3>
);

type AgentSheetProps = {
  orchestration: DeckCoordinationSummary | null;
  visuals: MascotVisuals | null;
  availableSkills: DeckAvailableSkill[];
  isSavingSkills?: boolean;
  isDeleting?: boolean;
  onClose: () => void;
  onTodoToggle?: ((coordinationId: string, itemIndex: number, done: boolean) => void) | undefined;
  onVaultFileClick: (coordinationId: string, fileName: string) => void;
  onVaultBrowse: (coordinationId: string) => void;
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
  onDelete?: ((coordinationId: string) => Promise<void>) | undefined;
};

export const AgentSheet = ({
  orchestration,
  visuals,
  availableSkills,
  isSavingSkills,
  isDeleting,
  onClose,
  onTodoToggle,
  onVaultFileClick,
  onVaultBrowse,
  onSaveSuggestedSkills,
  onSaveMascot,
  onSaveAgent,
  onDelete,
}: AgentSheetProps) => {
  const [message, setMessage] = useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);

  const [isCustomizing, setIsCustomizing] = useState(false);
  const [editColor, setEditColor] = useState("");

  const [editProvider, setEditProvider] = useState<TerminalAgentProvider | "">("");

  const [moodPreview, setMoodPreview] = useState<CuteMascotState | null>(null);
  const [isSavingLook, setIsSavingLook] = useState(false);

  const [isEditingSkills, setIsEditingSkills] = useState(false);
  const [draftSkills, setDraftSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");

  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const coordinationId = orchestration?.coordinationId ?? null;
  const [previousCoordinationId, setPreviousCoordinationId] = useState(coordinationId);

  if (previousCoordinationId !== coordinationId) {
    setPreviousCoordinationId(coordinationId);
    setMessage(null);
    setIsCustomizing(false);
    setIsEditingSkills(false);
    setConfirmingDelete(false);
    setMoodPreview(null);
    setNewSkill("");
  }

  const progressPct =
    orchestration && orchestration.todoTotal > 0
      ? Math.round((orchestration.todoDone / orchestration.todoTotal) * 100)
      : 0;

  const startCustomizing = () => {
    if (!orchestration || !visuals) {
      return;
    }

    setEditColor(visuals.color);
    setEditProvider(orchestration.agentProvider ?? "");
    setIsCustomizing(true);
  };

  const saveLook = async () => {
    if (!orchestration || !visuals) {
      return;
    }

    setIsSavingLook(true);
    setMessage(null);

    try {
      const savedMascot = await onSaveMascot?.(orchestration.coordinationId, {
        color: editColor,
        expression: visuals.expression,
        accessory: visuals.accessory,
      });

      if (savedMascot === false) {
        setMessage({ tone: "error", text: "Could not save the mascot color." });

        return;
      }

      const agentChanged = editProvider !== (orchestration.agentProvider ?? "");

      if (agentChanged) {
        const savedAgent = await onSaveAgent?.(orchestration.coordinationId, editProvider || null);

        if (savedAgent === false) {
          setMessage({ tone: "error", text: "Could not save the agent CLI." });

          return;
        }
      }

      setIsCustomizing(false);
    } catch {
      setMessage({ tone: "error", text: "Could not save changes." });
    } finally {
      setIsSavingLook(false);
    }
  };

  const skillNames = orchestration
    ? [...new Set([...availableSkills.map((skill) => skill.name), ...draftSkills])].sort((a, b) =>
        a.localeCompare(b),
      )
    : [];

  const addNewSkill = () => {
    const trimmed = newSkill.trim();

    if (trimmed && !draftSkills.includes(trimmed)) {
      setDraftSkills((current) => [...current, trimmed].sort((a, b) => a.localeCompare(b)));
    }

    setNewSkill("");
  };

  const baseState = orchestration ? MASCOT_STATE_FOR_STATUS[orchestration.status] : "idle";

  const shownState = moodPreview ?? baseState;

  const shownColor = isCustomizing && editColor ? editColor : (visuals?.color ?? "#b79cf0");

  return (
    <Sheet
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      open={orchestration !== null}
    >
      <SheetContent aria-label={orchestration ? `${orchestration.displayName} agent` : "Agent"}>
        {orchestration ? (
          <>
            <SheetHeader>
              <div className="flex items-center gap-4">
                <button
                  aria-expanded={isCustomizing}
                  aria-label="Customize this agent"
                  className={cn(
                    "grid size-20 shrink-0 place-items-center rounded-3xl bg-surface-2 transition-colors hover:bg-surface cursor-pointer",
                    isCustomizing && "ring-2 ring-primary",
                  )}
                  onClick={() => {
                    if (isCustomizing) {
                      setIsCustomizing(false);
                    } else {
                      startCustomizing();
                    }
                  }}
                  type="button"
                >
                  <CuteMascot color={shownColor} size={64} state={shownState} />
                </button>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <SheetTitle>{orchestration.displayName}</SheetTitle>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        STATUS_STYLES[orchestration.status],
                      )}
                    >
                      {STATUS_LABELS[orchestration.status]}
                    </span>
                    {orchestration.agentProvider ? (
                      <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        {orchestration.agentProvider}
                      </span>
                    ) : null}
                  </div>
                  <SheetDescription className="mt-1">
                    {orchestration.description || "No description yet."}
                  </SheetDescription>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Click the face to {isCustomizing ? "close" : "customize"}.
                  </p>
                </div>
              </div>
            </SheetHeader>

            <SheetBody>
              {isCustomizing ? (
                <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
                  <SectionTitle>Customize</SectionTitle>

                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium">Color</span>
                    <div className="flex flex-wrap items-center gap-2">
                      {MASCOT_COLORS.map((color) => (
                        <button
                          aria-label={`Use color ${formatColorForDisplay(color)}`}
                          aria-pressed={color === editColor}
                          className={cn(
                            "size-8 rounded-full border-2 transition-transform hover:scale-105 cursor-pointer",
                            color === editColor ? "border-foreground" : "border-transparent",
                          )}
                          key={color}
                          onClick={() => {
                            setEditColor(color);
                          }}
                          style={{ backgroundColor: color }}
                          type="button"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium">Preview a mood</span>
                    <div className="flex flex-wrap gap-2">
                      {MOOD_OPTIONS.map((mood) => (
                        <button
                          aria-pressed={shownState === mood.value}
                          className={chipClass(shownState === mood.value)}
                          key={mood.value}
                          onClick={() => {
                            setMoodPreview(mood.value === baseState ? null : mood.value);
                          }}
                          type="button"
                        >
                          {mood.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      The mood follows the agent&apos;s status: sleeping when idle, working when
                      active, happy when it needs a review, worried when blocked.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium">Agent CLI</span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        aria-pressed={editProvider === ""}
                        className={chipClass(editProvider === "")}
                        onClick={() => {
                          setEditProvider("");
                        }}
                        type="button"
                      >
                        Global default
                      </button>
                      {TERMINAL_AGENT_PROVIDERS.map((provider) => (
                        <button
                          aria-pressed={editProvider === provider}
                          className={chipClass(editProvider === provider)}
                          key={provider}
                          onClick={() => {
                            setEditProvider(provider);
                          }}
                          type="button"
                        >
                          {provider}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      className={actionButtonClass}
                      onClick={() => {
                        setIsCustomizing(false);
                        setMoodPreview(null);
                      }}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className={primaryButtonClass}
                      disabled={isSavingLook}
                      onClick={() => {
                        void saveLook();
                      }}
                      type="button"
                    >
                      {isSavingLook ? "Saving…" : "Save"}
                    </button>
                  </div>
                </section>
              ) : null}

              {message ? (
                <output
                  className={cn(
                    "text-sm",
                    message.tone === "error" ? "text-destructive" : "text-running",
                  )}
                >
                  {message.text}
                </output>
              ) : null}

              <section className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between">
                  <SectionTitle>Todos</SectionTitle>
                  {orchestration.todoTotal > 0 ? (
                    <span className="text-xs font-medium text-muted-foreground tabular-nums">
                      {orchestration.todoDone}/{orchestration.todoTotal}
                    </span>
                  ) : null}
                </div>
                {orchestration.todoTotal > 0 ? (
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                ) : null}
                {orchestration.todoItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No todos yet.</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {orchestration.todoItems.map((item, index) => (
                      <li key={item.text}>
                        <label
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 text-sm leading-snug transition-colors hover:bg-surface-2",
                            item.done && "text-muted-foreground line-through",
                          )}
                          htmlFor={`todo-${orchestration.coordinationId}-${index}`}
                        >
                          <input
                            checked={item.done}
                            id={`todo-${orchestration.coordinationId}-${index}`}
                            className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]"
                            onChange={() => {
                              onTodoToggle?.(orchestration.coordinationId, index, !item.done);
                            }}
                            type="checkbox"
                          />
                          {item.text}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between">
                  <SectionTitle>Skills</SectionTitle>
                  {!isEditingSkills ? (
                    <button
                      className="cursor-pointer text-xs font-medium text-primary hover:underline"
                      onClick={() => {
                        setDraftSkills(orchestration.suggestedSkills);
                        setIsEditingSkills(true);
                      }}
                      type="button"
                    >
                      Edit skills
                    </button>
                  ) : null}
                </div>
                {isEditingSkills ? (
                  <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
                    {skillNames.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No project skills found (.claude/skills, .opencode/skills, .agents/skills,
                        .kiro/skills).
                      </p>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {skillNames.map((skillName) => {
                          const skill = availableSkills.find((entry) => entry.name === skillName);

                          return (
                            <label
                              aria-label={skillName}
                              className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 text-sm hover:bg-surface-2"
                              htmlFor={`skill-${orchestration.coordinationId}-${skillName}`}
                              key={skillName}
                            >
                              <input
                                checked={draftSkills.includes(skillName)}
                                id={`skill-${orchestration.coordinationId}-${skillName}`}
                                className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]"
                                onChange={() => {
                                  setDraftSkills((current) =>
                                    current.includes(skillName)
                                      ? current.filter((entry) => entry !== skillName)
                                      : [...current, skillName].sort((a, b) => a.localeCompare(b)),
                                  );
                                }}
                                type="checkbox"
                              />
                              <span className="flex flex-col">
                                <span className="font-medium">{skillName}</span>
                                <span className="text-xs text-muted-foreground">
                                  {skill?.description ??
                                    "Stored on this orchestration, but not available right now."}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        aria-label="New skill name"
                        className="h-9 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                        onChange={(event) => {
                          setNewSkill(event.target.value);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addNewSkill();
                          }
                        }}
                        placeholder="New skill name…"
                        type="text"
                        value={newSkill}
                      />
                      <button className={actionButtonClass} onClick={addNewSkill} type="button">
                        Add
                      </button>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        className={actionButtonClass}
                        onClick={() => {
                          setIsEditingSkills(false);
                          setNewSkill("");
                        }}
                        type="button"
                      >
                        Cancel
                      </button>
                      <button
                        className={primaryButtonClass}
                        disabled={Boolean(isSavingSkills)}
                        onClick={() => {
                          void (async () => {
                            const saved = await onSaveSuggestedSkills?.(
                              orchestration.coordinationId,
                              draftSkills,
                            );

                            if (saved) {
                              setIsEditingSkills(false);
                            }
                          })();
                        }}
                        type="button"
                      >
                        {isSavingSkills ? "Saving…" : "Save skills"}
                      </button>
                    </div>
                  </div>
                ) : orchestration.suggestedSkills.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {orchestration.suggestedSkills.map((skill) => (
                      <span
                        className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium"
                        key={skill}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No skills selected.</p>
                )}
              </section>

              <section className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between">
                  <SectionTitle>Vault files</SectionTitle>
                  <button
                    className="cursor-pointer text-xs font-medium text-primary hover:underline"
                    onClick={() => {
                      onClose();
                      onVaultBrowse(orchestration.coordinationId);
                    }}
                    type="button"
                  >
                    Browse vault
                  </button>
                </div>
                {orchestration.vaultFiles.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {orchestration.vaultFiles.map((file) => (
                      <button
                        className={actionButtonClass}
                        key={file}
                        onClick={() => {
                          onClose();
                          onVaultFileClick(orchestration.coordinationId, file);
                        }}
                        type="button"
                      >
                        {file}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No vault files yet.</p>
                )}
              </section>

              {onDelete ? (
                <section className="flex flex-col gap-3 border-t border-border pt-6">
                  <SectionTitle>Danger zone</SectionTitle>
                  {confirmingDelete ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        Delete this orchestration and its vault files?
                      </span>
                      <button
                        className="inline-flex h-9 cursor-pointer items-center rounded-xl bg-destructive px-4 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
                        disabled={Boolean(isDeleting)}
                        onClick={() => {
                          void (async () => {
                            await onDelete(orchestration.coordinationId);
                            onClose();
                          })();
                        }}
                        type="button"
                      >
                        {isDeleting ? "Deleting…" : "Yes, delete"}
                      </button>
                      <button
                        className={actionButtonClass}
                        onClick={() => {
                          setConfirmingDelete(false);
                        }}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div>
                      <button
                        className="inline-flex h-9 cursor-pointer items-center rounded-xl border border-destructive/40 px-4 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                        onClick={() => {
                          setConfirmingDelete(true);
                        }}
                        type="button"
                      >
                        Delete orchestration…
                      </button>
                    </div>
                  )}
                </section>
              ) : null}
            </SheetBody>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
};
