import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  DeckAvailableSkill,
  DeckCoordinationSummary,
  WorkspaceSetupSnapshot,
  WorkspaceSetupStepId,
} from "@adadex/core";
import { useClickOutside } from "../app/hooks/useClickOutside";
import { useAgentProviderPreference } from "../app/hooks/useAgentProviderPreference";
import type { TerminalAgentProvider } from "../app/types";
import {
  buildDeckOrchestrationSkillsUrl,
  buildDeckOrchestrationUrl,
  buildDeckOrchestrationsUrl,
  buildDeckSkillsUrl,
  buildDeckTodoToggleUrl,
  buildDeckVaultFileUrl,
  buildTerminalsUrl,
} from "../runtime/runtimeEndpoints";
import { Terminal } from "./Terminal";
import { ActionCards } from "./deck/ActionCards";
import { AddOrchestrationForm } from "./deck/AddOrchestrationForm";
import type { MascotAppearancePayload } from "./deck/AddOrchestrationForm";
import { DeckBottomActions } from "./deck/DeckBottomActions";
import { OrchestrationPod } from "./deck/OrchestrationPod";
import { WorkspaceSetupCard } from "./deck/WorkspaceSetupCard";
import { type MascotVisuals, deriveMascotVisuals } from "./deck/mascotVisuals";
import { MarkdownContent } from "./ui/MarkdownContent";

export type { MascotAppearancePayload } from "./deck/AddOrchestrationForm";

const normalizeDeckAvailableSkill = (value: unknown): DeckAvailableSkill | null => {
  if (value === null || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.name !== "string") return null;

  return {
    name: record.name,
    description: typeof record.description === "string" ? record.description : "",
    source: record.source === "project" ? "project" : "user",
  };
};

// ─── Main view ───────────────────────────────────────────────────────────────

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
};

export const DeckPrimaryView = ({
  onSidebarContent,
  workspaceSetup,
  isWorkspaceSetupLoading,
  workspaceSetupError,
  onRefreshWorkspaceSetup,
  onRunWorkspaceSetupStep,
  suppressWorkspaceSetupCard = false,
}: DeckPrimaryViewProps) => {
  const [orchestrations, setOrchestrations] = useState<DeckCoordinationSummary[]>([]);
  const [focus, setFocus] = useState<FocusState | null>(null);
  const [vaultContent, setVaultContent] = useState<string | null>(null);
  const [loadingVault, setLoadingVault] = useState(false);
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
  const [runningSetupStepId, setRunningSetupStepId] = useState<
    | "initialize-workspace"
    | "ensure-gitignore"
    | "check-codex"
    | "check-git"
    | "check-curl"
    | "create-coordinations"
    | null
  >(null);

  // Fetch orchestration list
  const fetchOrchestrations = useCallback(async () => {
    try {
      const response = await fetch(buildDeckOrchestrationsUrl(), {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return;
      const data = await response.json();
      setOrchestrations(data);
      await onRefreshWorkspaceSetup();
    } catch {
      // silently ignore
    }
  }, [onRefreshWorkspaceSetup]);

  useEffect(() => {
    void fetchOrchestrations();
  }, [fetchOrchestrations]);

  useEffect(() => {
    let cancelled = false;

    const fetchSkills = async () => {
      try {
        const response = await fetch(buildDeckSkillsUrl(), {
          headers: { Accept: "application/json" },
        });
        if (!response.ok) return;
        const payload = (await response.json()) as unknown;
        if (!Array.isArray(payload) || cancelled) return;
        const skills = payload
          .map((entry) => normalizeDeckAvailableSkill(entry))
          .filter((entry): entry is DeckAvailableSkill => entry !== null);
        if (!cancelled) {
          setAvailableSkills(skills);
        }
      } catch {
        // silently ignore
      }
    };

    void fetchSkills();
    return () => {
      cancelled = true;
    };
  }, []);

  // Precompute visuals for all orchestrations
  const visualsMap = useMemo(() => {
    const map = new Map<string, MascotVisuals>();
    for (const t of orchestrations) {
      map.set(t.coordinationId, deriveMascotVisuals(t));
    }
    return map;
  }, [orchestrations]);

  // Fetch vault file content when focus changes
  useEffect(() => {
    if (!focus || focus.type !== "vault") {
      setVaultContent(null);
      return;
    }

    let cancelled = false;
    setLoadingVault(true);
    const fetchVault = async () => {
      try {
        const response = await fetch(buildDeckVaultFileUrl(focus.coordinationId, focus.fileName), {
          headers: { Accept: "text/markdown" },
        });
        if (cancelled) return;
        if (!response.ok) {
          setVaultContent(null);
          setLoadingVault(false);
          return;
        }
        const text = await response.text();
        if (!cancelled) {
          setVaultContent(text);
          setLoadingVault(false);
        }
      } catch {
        if (!cancelled) {
          setVaultContent(null);
          setLoadingVault(false);
        }
      }
    };
    void fetchVault();
    return () => {
      cancelled = true;
    };
  }, [focus]);

  // Agent menu click-outside/escape
  const handleDismissAgentMenu = useCallback(() => setAgentMenuOpen(false), []);
  useClickOutside(agentMenuRef, agentMenuOpen, handleDismissAgentMenu);

  const handleVaultFileClick = useCallback((coordinationId: string, fileName: string) => {
    setFocus({ type: "vault", coordinationId, fileName });
  }, []);

  const handleClose = useCallback(() => {
    setFocus(null);
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
      const agentId = (data.terminalId ?? data.coordinationId) as string;
      setFocus({
        type: "terminal",
        agentId,
        terminalLabel: "Orchestration Planner",
      });
      await fetchOrchestrations();
    } catch {
      // silently ignore
    } finally {
      setIsLaunchingAgent(false);
    }
  }, [selectedAgent, fetchOrchestrations]);

  const handleRunSetupStep = useCallback(
    async (
      stepId:
        | "initialize-workspace"
        | "ensure-gitignore"
        | "check-codex"
        | "check-git"
        | "check-curl"
        | "create-coordinations",
    ) => {
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
            body && typeof body === "object" && "error" in body && typeof body.error === "string"
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
    async (coordinationId: string, mascot: { color: string; expression: string; accessory: string }) => {
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
        // silently ignore
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
      } catch {
        // silently ignore
      }
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

  // Push sidebar content to the shared sidebar
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
    ],
  );

  useEffect(() => {
    onSidebarContent?.(sidebarContent);
    return () => onSidebarContent?.(null);
  }, [onSidebarContent, sidebarContent]);

  // ─── Empty state (no orchestrations) ─────────────────────────────────────────────

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

  // ─── Populated state ────────────────────────────────────────────────────────

  return (
    <section
      className="deck-view"
      data-mode={mode}
      data-has-pods={orchestrations.length > 0}
      aria-label="Deck"
    >
      <div className="deck-pods-container">
        {orchestrations.map((t) => {
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
                visuals={visualsMap.get(t.coordinationId) as MascotVisuals}
                isFocused={isThis}
                activeFileName={focus?.type === "vault" && isThis ? focus.fileName : undefined}
                onVaultFileClick={(fileName) =>
                  setFocus({
                    type: "vault",
                    coordinationId: t.coordinationId,
                    fileName,
                  })
                }
                onVaultBrowse={() =>
                  setFocus({
                    type: "vault-browser",
                    coordinationId: t.coordinationId,
                  })
                }
                onClose={handleClose}
                onDelete={() => handleDeleteOrchestration(t.coordinationId)}
                isDeleting={deletingOrchestrationId === t.coordinationId}
                onTodoToggle={handleTodoToggle}
                availableSkills={availableSkills}
                isSavingSkills={savingOrchestrationSkillsId === t.coordinationId}
                onSaveSuggestedSkills={handleOrchestrationSkillsSave}
                onSaveMascot={handleMascotSave}
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
            </header>
            <div
              className="deck-detail-main-content"
              key={`${focus.coordinationId}/${focus.fileName}`}
            >
              {loadingVault ? (
                <span className="deck-detail-loading">Loading…</span>
              ) : vaultContent !== null ? (
                <MarkdownContent content={vaultContent} className="deck-detail-markdown" />
              ) : (
                <span className="deck-detail-loading">File not found.</span>
              )}
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
    </section>
  );
};
