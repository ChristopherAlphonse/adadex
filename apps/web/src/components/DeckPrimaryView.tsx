import type {
  CoordinationWorkspaceMode,
  DeckAvailableSkill,
  DeckCoordinationSummary,
  WorkspaceSetupSnapshot,
  WorkspaceSetupStepId,
} from "@adadex/core";
import { asRecord, isObjectValue, isString, type ParsedValue } from "@adadex/core";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAgentProviderPreference } from "../app/hooks/useAgentProviderPreference";
import { useClickOutside } from "../app/hooks/useClickOutside";
import type { TerminalAgentProvider } from "../app/types";
import {
  buildDeckCoordinationAgentUrl,
  buildDeckOrchestrationSkillsUrl,
  buildDeckOrchestrationsUrl,
  buildDeckOrchestrationUrl,
  buildDeckSkillsUrl,
  buildDeckTodoToggleUrl,
  buildDeckVaultFileUrl,
  buildTerminalsUrl,
} from "../runtime/runtimeEndpoints";
import { ActionCards } from "./deck/ActionCards";
import type { MascotAppearancePayload } from "./deck/AddOrchestrationForm";
import { AddOrchestrationForm } from "./deck/AddOrchestrationForm";
import { AgentSheet } from "./deck/AgentSheet";
import { DeckBottomActions } from "./deck/DeckBottomActions";
import { deriveMascotVisuals, type MascotVisuals } from "./deck/mascotVisuals";
import { OrchestrationPod } from "./deck/OrchestrationPod";
import { VaultFileEditor } from "./deck/VaultFileEditor";
import { WorkspaceSetupCard } from "./deck/WorkspaceSetupCard";
import { Terminal } from "./Terminal";
import { MarkdownContent } from "./ui/MarkdownContent";

export type { MascotAppearancePayload } from "./deck/AddOrchestrationForm";

const normalizeDeckAvailableSkill = (value: ParsedValue): DeckAvailableSkill | null => {
  const record = asRecord(value);

  if (!record || !isString(record.name)) return null;

  return {
    name: record.name,
    description: isString(record.description) ? record.description : "",
    source: record.source === "project" ? "project" : "user",
  };
};

type FocusState =
  | { type: "vault-browser"; coordinationId: string }
  | { type: "vault"; coordinationId: string; fileName: string }
  | { type: "terminal"; agentId: string; terminalLabel: string };

type EmptyViewMode = "idle" | "adding";

type DeckPrimaryViewProps = {
  onSidebarContent?: ((content: ReactNode) => void) | undefined;
  workspaceSetup: WorkspaceSetupSnapshot | null;
  isWorkspaceSetupLoading: boolean;
  workspaceSetupError: string | null;
  onRefreshWorkspaceSetup: () => Promise<WorkspaceSetupSnapshot | null>;
  onRunWorkspaceSetupStep: (stepId: WorkspaceSetupStepId) => Promise<WorkspaceSetupSnapshot | null>;
  suppressWorkspaceSetupCard?: boolean;
  onCreateAgent?: (coordinationId: string) => Promise<string | undefined>;
  onSpawnSwarm?: (
    coordinationId: string,
    workspaceMode: CoordinationWorkspaceMode,
  ) => Promise<void>;
};

type LoadedVaultFile = { focus: FocusState; content: string | null };

const EDITABLE_VAULT_FILE_NAMES: ReadonlySet<string> = new Set(["todo.md"]);

const canEditVaultFile = (fileName: string) => EDITABLE_VAULT_FILE_NAMES.has(fileName);

const requestDeckOrchestrations = async (): Promise<DeckCoordinationSummary[] | null> => {
  try {
    const response = await fetch(buildDeckOrchestrationsUrl(), {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) return null;

    return await response.json();
  } catch {
    return null;
  }
};

export const DeckPrimaryView = ({
  onSidebarContent,
  workspaceSetup,
  isWorkspaceSetupLoading,
  workspaceSetupError,
  onRefreshWorkspaceSetup,
  onRunWorkspaceSetupStep,
  suppressWorkspaceSetupCard = false,
  onCreateAgent,
  onSpawnSwarm,
}: DeckPrimaryViewProps) => {
  const [orchestrations, setOrchestrations] = useState<DeckCoordinationSummary[]>([]);
  const [focus, setFocus] = useState<FocusState | null>(null);
  const [sheetCoordinationId, setSheetCoordinationId] = useState<string | null>(null);
  const [loadedVault, setLoadedVault] = useState<LoadedVaultFile | null>(null);
  const [editingVaultFocus, setEditingVaultFocus] = useState<FocusState | null>(null);
  const [vaultDraft, setVaultDraft] = useState("");
  const [vaultSaveError, setVaultSaveError] = useState<string | null>(null);
  const [isSavingVault, setIsSavingVault] = useState(false);
  const [emptyViewMode, setEmptyViewMode] = useState<EmptyViewMode>("idle");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [availableSkills, setAvailableSkills] = useState<DeckAvailableSkill[]>([]);

  const [savingOrchestrationSkillsId, setSavingOrchestrationSkillsId] = useState<string | null>(
    null,
  );

  const { agentProvider: selectedAgent, setAgentProvider: setSelectedAgent } =
    useAgentProviderPreference();

  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const agentMenuRef = useRef<HTMLDivElement>(null);
  const [isLaunchingAgent, setIsLaunchingAgent] = useState(false);
  const [runningSetupStepId, setRunningSetupStepId] = useState<WorkspaceSetupStepId | null>(null);

  const fetchOrchestrations = useCallback(async () => {
    const data = await requestDeckOrchestrations();

    if (data === null) return;

    setOrchestrations(data);

    try {
      await onRefreshWorkspaceSetup();
    } catch {}
  }, [onRefreshWorkspaceSetup]);

  useEffect(() => {
    let cancelled = false;

    void requestDeckOrchestrations().then(async (data) => {
      if (cancelled || data === null) return;

      setOrchestrations(data);

      try {
        await onRefreshWorkspaceSetup();
      } catch {}
    });

    return () => {
      cancelled = true;
    };
  }, [onRefreshWorkspaceSetup]);

  useEffect(() => {
    let cancelled = false;

    const fetchSkills = async () => {
      try {
        const response = await fetch(buildDeckSkillsUrl(), {
          headers: { Accept: "application/json" },
        });

        if (!response.ok) return;
        const payload: ParsedValue = await response.json();

        if (!Array.isArray(payload) || cancelled) return;

        const skills = payload
          .map((entry) => normalizeDeckAvailableSkill(entry))
          .filter((entry): entry is DeckAvailableSkill => entry !== null);

        if (!cancelled) {
          setAvailableSkills(skills);
        }
      } catch {}
    };

    void fetchSkills();

    return () => {
      cancelled = true;
    };
  }, []);

  const visualsMap = useMemo(() => {
    const map = new Map<string, MascotVisuals>();

    for (const t of orchestrations) {
      map.set(t.coordinationId, deriveMascotVisuals(t));
    }

    return map;
  }, [orchestrations]);

  useEffect(() => {
    if (focus?.type !== "vault") return;

    let cancelled = false;

    const fetchVault = async () => {
      let content: string | null = null;

      try {
        const response = await fetch(buildDeckVaultFileUrl(focus.coordinationId, focus.fileName), {
          headers: { Accept: "text/markdown" },
        });

        if (response.ok) {
          content = await response.text();
        }
      } catch {
        content = null;
      }

      if (!cancelled) {
        setLoadedVault({ focus, content });
      }
    };

    void fetchVault();

    return () => {
      cancelled = true;
    };
  }, [focus]);

  const isVaultFocused = focus?.type === "vault";
  const vaultContent = isVaultFocused && loadedVault?.focus === focus ? loadedVault.content : null;
  const loadingVault = isVaultFocused && loadedVault?.focus !== focus;
  const isEditingVault = isVaultFocused && editingVaultFocus === focus;
  const isVaultEditable = focus?.type === "vault" && canEditVaultFile(focus.fileName);

  const handleDismissAgentMenu = useCallback(() => setAgentMenuOpen(false), []);
  useClickOutside(agentMenuRef, agentMenuOpen, handleDismissAgentMenu);

  const _handleVaultFileClick = useCallback((coordinationId: string, fileName: string) => {
    setFocus({ type: "vault", coordinationId, fileName });
  }, []);

  const handleStartVaultEdit = useCallback(() => {
    if (focus?.type !== "vault" || vaultContent === null) return;

    setVaultDraft(vaultContent);
    setVaultSaveError(null);
    setEditingVaultFocus(focus);
  }, [focus, vaultContent]);

  const handleCancelVaultEdit = useCallback(() => {
    setEditingVaultFocus(null);
    setVaultSaveError(null);
  }, []);

  const handleSaveVault = useCallback(async () => {
    if (focus?.type !== "vault" || vaultContent === null) return;

    setIsSavingVault(true);
    setVaultSaveError(null);

    try {
      const response = await fetch(buildDeckVaultFileUrl(focus.coordinationId, focus.fileName), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/markdown",
        },
        body: JSON.stringify({ content: vaultDraft }),
      });

      if (!response.ok) {
        const payload: ParsedValue = await response.json().catch(() => null);
        const message = asRecord(payload)?.error;

        setVaultSaveError(isString(message) ? message : "Could not save file.");

        return;
      }

      const savedContent = await response.text();

      setLoadedVault({ focus, content: savedContent });
      setEditingVaultFocus(null);
      await fetchOrchestrations();
    } catch {
      setVaultSaveError("Could not save file.");
    } finally {
      setIsSavingVault(false);
    }
  }, [fetchOrchestrations, focus, vaultContent, vaultDraft]);

  const handleClose = useCallback(() => {
    setFocus(null);
    setEditingVaultFocus(null);
  }, []);

  const handleLaunchAgent = useCallback(async () => {
    setIsLaunchingAgent(true);

    try {
      const response = await fetch(buildTerminalsUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          name: "coordination-planner",
          workspaceMode: "shared",
          agentProvider: selectedAgent,
          promptTemplate: "coordination-planner",
        }),
      });

      if (!response.ok) return;
      const data = await response.json();
      // SAFETY: the terminal creation response carries one of these string identifiers.
      const agentId = (data.terminalId ?? data.coordinationId) as string;
      setFocus({
        type: "terminal",
        agentId,
        terminalLabel: "Orchestration Planner",
      });
      await fetchOrchestrations();
    } catch {
    } finally {
      setIsLaunchingAgent(false);
    }
  }, [selectedAgent, fetchOrchestrations]);

  const handleRunSetupStep = useCallback(
    async (stepId: WorkspaceSetupStepId) => {
      setRunningSetupStepId(stepId);

      try {
        await onRunWorkspaceSetupStep(stepId);

        if (stepId === "initialize-workspace" || stepId === "ensure-gitignore") {
          await fetchOrchestrations();
        }
      } finally {
        setRunningSetupStepId(null);
      }
    },
    [fetchOrchestrations, onRunWorkspaceSetupStep],
  );

  const handleCreateCoordination = useCallback(
    async (
      name: string,
      description: string,
      color: string,
      mascot: MascotAppearancePayload,
      suggestedSkills: string[],
    ) => {
      setIsCreating(true);
      setCreateError(null);

      try {
        const response = await fetch(buildDeckOrchestrationsUrl(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            name,
            description,
            color,
            mascot,
            suggestedSkills,
          }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null);

          const msg =
            body && isObjectValue(body) && "error" in body && isString(body.error)
              ? body.error
              : "Failed to create orchestration";

          setCreateError(msg);

          return;
        }

        setEmptyViewMode("idle");
        await fetchOrchestrations();
        await onRefreshWorkspaceSetup();
      } catch {
        setCreateError("Network error");
      } finally {
        setIsCreating(false);
      }
    },
    [fetchOrchestrations, onRefreshWorkspaceSetup],
  );

  const handleMascotSave = useCallback(
    async (
      coordinationId: string,
      mascot: { color: string; expression: string; accessory: string },
    ) => {
      try {
        const response = await fetch(buildDeckOrchestrationUrl(coordinationId), {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            color: mascot.color,
            mascot: {
              animation: null,
              expression: mascot.expression,
              accessory: mascot.accessory,
              hairColor: mascot.color,
            },
          }),
        });

        if (!response.ok) return false;

        const updated: DeckCoordinationSummary = await response.json();
        setOrchestrations((current) =>
          current.map((item) => (item.coordinationId === coordinationId ? updated : item)),
        );
        await fetchOrchestrations();

        return true;
      } catch {
        return false;
      }
    },
    [fetchOrchestrations],
  );

  const handleSaveCoordinationAgent = useCallback(
    async (coordinationId: string, agentProvider: TerminalAgentProvider | null) => {
      try {
        const response = await fetch(buildDeckCoordinationAgentUrl(coordinationId), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentProvider }),
        });

        if (!response.ok) return false;
        await fetchOrchestrations();

        return true;
      } catch {
        return false;
      }
    },
    [fetchOrchestrations],
  );

  const handleOrchestrationSkillsSave = useCallback(
    async (coordinationId: string, suggestedSkills: string[]) => {
      setSavingOrchestrationSkillsId(coordinationId);

      try {
        const response = await fetch(buildDeckOrchestrationSkillsUrl(coordinationId), {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ suggestedSkills }),
        });

        if (!response.ok) return false;
        await fetchOrchestrations();

        return true;
      } catch {
        return false;
      } finally {
        setSavingOrchestrationSkillsId((current) => (current === coordinationId ? null : current));
      }
    },
    [fetchOrchestrations],
  );

  const [deletingOrchestrationId, setDeletingOrchestrationId] = useState<string | null>(null);

  const handleDeleteOrchestration = useCallback(
    async (coordinationId: string) => {
      setDeletingOrchestrationId(coordinationId);

      try {
        const response = await fetch(buildDeckOrchestrationUrl(coordinationId), {
          method: "DELETE",
        });

        if (!response.ok) return;
        await fetchOrchestrations();
      } catch {
      } finally {
        setDeletingOrchestrationId(null);
      }
    },
    [fetchOrchestrations],
  );

  const handleTodoToggle = useCallback(
    async (coordinationId: string, itemIndex: number, done: boolean) => {
      try {
        const response = await fetch(buildDeckTodoToggleUrl(coordinationId), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemIndex, done }),
        });

        if (!response.ok) return;
        await fetchOrchestrations();
      } catch {}
    },
    [fetchOrchestrations],
  );

  const focusedOrchestration =
    focus?.type === "vault" || focus?.type === "vault-browser"
      ? orchestrations.find((t) => t.coordinationId === focus.coordinationId)
      : null;

  const mode = focus ? "detail" : "grid";

  const shouldShowWorkspaceSetup =
    !suppressWorkspaceSetupCard &&
    orchestrations.length === 0 &&
    workspaceSetup?.shouldShowSetupCard;

  const sidebarContent = useMemo(
    () =>
      orchestrations.length > 0 || focus?.type === "terminal" ? (
        <div className="deck-sidebar-content">
          <div className="deck-sidebar-content-top">
            {shouldShowWorkspaceSetup ? (
              <WorkspaceSetupCard
                compact
                workspaceSetup={workspaceSetup}
                isLoading={isWorkspaceSetupLoading}
                error={workspaceSetupError}
                onRunStep={handleRunSetupStep}
                onLaunchAgent={handleLaunchAgent}
                isLaunchingAgent={isLaunchingAgent}
                isRunningStepId={runningSetupStepId}
              />
            ) : (
              <ActionCards
                compact
                selectedAgent={selectedAgent}
                setSelectedAgent={setSelectedAgent}
                agentMenuOpen={agentMenuOpen}
                setAgentMenuOpen={setAgentMenuOpen}
                agentMenuRef={agentMenuRef}
                onAdd={() => {
                  setEmptyViewMode("adding");
                  setCreateError(null);
                }}
                onLaunchAgent={handleLaunchAgent}
                isLaunchingAgent={isLaunchingAgent}
              />
            )}
          </div>
          {orchestrations.length > 0 && (
            <div className="deck-sidebar-content-bottom">
              <DeckBottomActions
                onClearAll={async () => {
                  for (const t of orchestrations) {
                    await fetch(buildDeckOrchestrationUrl(t.coordinationId), {
                      method: "DELETE",
                    });
                  }

                  await fetchOrchestrations();
                }}
              />
            </div>
          )}
        </div>
      ) : null,
    [
      agentMenuOpen,
      fetchOrchestrations,
      focus?.type,
      handleLaunchAgent,
      handleRunSetupStep,
      isLaunchingAgent,
      isWorkspaceSetupLoading,
      runningSetupStepId,
      selectedAgent,
      shouldShowWorkspaceSetup,
      orchestrations,
      workspaceSetup,
      workspaceSetupError,
      setSelectedAgent,
    ],
  );

  useEffect(() => {
    onSidebarContent?.(sidebarContent);

    return () => onSidebarContent?.(null);
  }, [onSidebarContent, sidebarContent]);

  if (orchestrations.length === 0 && focus?.type !== "terminal") {
    return (
      <section
        className="deck-view"
        data-mode="grid"
        data-empty-mode={emptyViewMode}
        aria-label="Deck"
      >
        <div className="deck-empty-state">
          <div className="deck-empty-left">
            {shouldShowWorkspaceSetup ? (
              <WorkspaceSetupCard
                workspaceSetup={workspaceSetup}
                isLoading={isWorkspaceSetupLoading}
                error={workspaceSetupError}
                onRunStep={handleRunSetupStep}
                onLaunchAgent={handleLaunchAgent}
                isLaunchingAgent={isLaunchingAgent}
                isRunningStepId={runningSetupStepId}
              />
            ) : (
              <ActionCards
                selectedAgent={selectedAgent}
                setSelectedAgent={setSelectedAgent}
                agentMenuOpen={agentMenuOpen}
                setAgentMenuOpen={setAgentMenuOpen}
                agentMenuRef={agentMenuRef}
                onAdd={() => {
                  setEmptyViewMode("adding");
                  setCreateError(null);
                }}
                onLaunchAgent={handleLaunchAgent}
                isLaunchingAgent={isLaunchingAgent}
              />
            )}
          </div>
          {emptyViewMode === "adding" && (
            <div className="deck-empty-right">
              <AddOrchestrationForm
                onSubmit={handleCreateCoordination}
                onCancel={() => setEmptyViewMode("idle")}
                isSubmitting={isCreating}
                error={createError}
                availableSkills={availableSkills}
              />
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      className="deck-view"
      data-mode={mode}
      data-has-pods={orchestrations.length > 0}
      aria-label="Deck"
    >
      <div className="deck-pods-container">
        {orchestrations.map((t) => {
          const visuals = visualsMap.get(t.coordinationId);

          if (!visuals) return null;

          const isThis =
            (focus?.type === "vault" || focus?.type === "vault-browser") &&
            focus.coordinationId === t.coordinationId;

          return (
            <div
              key={t.coordinationId}
              className="deck-pod-slot"
              data-pod-role={isThis ? "focused" : focus ? "other" : "idle"}
            >
              <OrchestrationPod
                orchestration={t}
                visuals={visuals}
                isFocused={isThis}
                activeFileName={focus?.type === "vault" && isThis ? focus.fileName : undefined}
                onVaultFileClick={(fileName) =>
                  setFocus({
                    type: "vault",
                    coordinationId: t.coordinationId,
                    fileName,
                  })
                }
                onClose={handleClose}
                onOpen={() => setSheetCoordinationId(t.coordinationId)}
                onTodoToggle={handleTodoToggle}
              />
            </div>
          );
        })}
        {emptyViewMode === "adding" && (
          <div className="deck-pod-slot">
            <AddOrchestrationForm
              onSubmit={handleCreateCoordination}
              onCancel={() => setEmptyViewMode("idle")}
              isSubmitting={isCreating}
              error={createError}
              availableSkills={availableSkills}
            />
          </div>
        )}
      </div>

      <div className="deck-detail-main">
        {focus?.type === "vault-browser" && focusedOrchestration && (
          <>
            <header className="deck-detail-main-header">
              <button type="button" className="deck-add-form-back" onClick={handleClose}>
                ← Back
              </button>
              <span className="deck-detail-main-path">
                <strong>{focusedOrchestration.displayName}</strong> / vault
              </span>
            </header>
            <div className="deck-detail-main-content deck-vault-browser">
              <pre className="deck-vault-tree">
                <span className="deck-vault-tree-dir">
                  .adadex/coordinations/{focusedOrchestration.coordinationId}/
                </span>
                {(() => {
                  const files = [...focusedOrchestration.vaultFiles, "CONTEXT.md"];

                  return files.map((file, i) => {
                    const isLast = i === files.length - 1;
                    const prefix = isLast ? "└── " : "├── ";

                    return (
                      <span key={file} className="deck-vault-tree-row">
                        <span className="deck-vault-tree-branch">{prefix}</span>
                        <button
                          type="button"
                          className="deck-vault-tree-file"
                          onClick={() =>
                            setFocus({
                              type: "vault",
                              coordinationId: focus.coordinationId,
                              fileName: file,
                            })
                          }
                        >
                          {file}
                        </button>
                      </span>
                    );
                  });
                })()}
              </pre>
            </div>
          </>
        )}
        {focus?.type === "vault" && focusedOrchestration && (
          <>
            <header className="deck-detail-main-header">
              <button
                type="button"
                className="deck-add-form-back"
                onClick={() =>
                  setFocus({
                    type: "vault-browser",
                    coordinationId: focus.coordinationId,
                  })
                }
              >
                ← Back
              </button>
              <span className="deck-detail-main-path">
                {focusedOrchestration.displayName} / <strong>{focus.fileName}</strong>
              </span>
              {isVaultEditable && !isEditingVault && !loadingVault && vaultContent !== null ? (
                <button
                  className="ml-auto cursor-pointer rounded-lg border border-border bg-background px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-surface-2"
                  onClick={handleStartVaultEdit}
                  type="button"
                >
                  Edit
                </button>
              ) : null}
            </header>
            <div
              className="deck-detail-main-content"
              key={`${focus.coordinationId}/${focus.fileName}`}
            >
              <div className={isEditingVault ? "pb-72" : undefined}>
                {loadingVault ? (
                  <span className="deck-detail-loading">Loading…</span>
                ) : vaultContent !== null ? (
                  <MarkdownContent content={vaultContent} className="deck-detail-markdown" />
                ) : (
                  <span className="deck-detail-loading">File not found.</span>
                )}
              </div>
            </div>
          </>
        )}
        {focus?.type === "terminal" && (
          <div className="deck-detail-terminal" key={focus.agentId}>
            <header className="deck-detail-main-header">
              <button type="button" className="deck-add-form-back" onClick={handleClose}>
                ← Back
              </button>
              <span className="deck-detail-main-path">
                <strong>{focus.terminalLabel}</strong>
              </span>
            </header>
            <Terminal terminalId={focus.agentId} terminalLabel={focus.terminalLabel} />
          </div>
        )}
      </div>

      {isEditingVault && vaultContent !== null ? (
        <div className="absolute inset-x-0 bottom-0 z-30 border-t border-border bg-surface px-6 py-4 shadow-[0_-8px_24px_rgba(0,0,0,0.12)]">
          <VaultFileEditor
            error={vaultSaveError}
            fileName={focus?.type === "vault" ? focus.fileName : ""}
            isSaving={isSavingVault}
            onChange={setVaultDraft}
            onCancel={handleCancelVaultEdit}
            onSave={() => void handleSaveVault()}
            value={vaultDraft}
          />
        </div>
      ) : null}

      <AgentSheet
        orchestration={
          orchestrations.find((item) => item.coordinationId === sheetCoordinationId) ?? null
        }
        visuals={sheetCoordinationId ? (visualsMap.get(sheetCoordinationId) ?? null) : null}
        onClose={() => setSheetCoordinationId(null)}
        onTodoToggle={handleTodoToggle}
        onVaultFileClick={(coordinationId, fileName) =>
          setFocus({ type: "vault", coordinationId, fileName })
        }
        onVaultBrowse={(coordinationId) => setFocus({ type: "vault-browser", coordinationId })}
        availableSkills={availableSkills}
        isSavingSkills={savingOrchestrationSkillsId === sheetCoordinationId}
        isDeleting={deletingOrchestrationId === sheetCoordinationId}
        onSaveSuggestedSkills={handleOrchestrationSkillsSave}
        onSaveMascot={handleMascotSave}
        onSaveAgent={handleSaveCoordinationAgent}
        onDelete={handleDeleteOrchestration}
        onCreateAgent={onCreateAgent}
        onSpawnSwarm={onSpawnSwarm}
      />
    </section>
  );
};
