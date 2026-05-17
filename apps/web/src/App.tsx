import { type TerminalSnapshot, buildTerminalList, isAgentRuntimeState } from "@adadex/core";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { ColorThemeProvider, useColorThemeContext } from "./app/ColorThemeContext";
import { useAgentProviderPreference } from "./app/hooks/useAgentProviderPreference";
import { useBackendLivenessPolling } from "./app/hooks/useBackendLivenessPolling";
import { DECK_LEAD_ID } from "./app/hooks/useCanvasGraphData";
import { useCodexUsagePolling } from "./app/hooks/useCodexUsagePolling";
import { useConsoleKeyboardShortcuts } from "./app/hooks/useConsoleKeyboardShortcuts";
import { useGitHubPrimaryViewModel } from "./app/hooks/useGitHubPrimaryViewModel";
import { useGithubSummaryPolling } from "./app/hooks/useGithubSummaryPolling";
import { useInitialColumnsHydration } from "./app/hooks/useInitialColumnsHydration";
import { useOrchestrationGitLifecycle } from "./app/hooks/useOrchestrationGitLifecycle";
import { usePersistedUiState } from "./app/hooks/usePersistedUiState";
import { useTerminalCompletionNotification } from "./app/hooks/useTerminalCompletionNotification";
import { useTerminalMutations } from "./app/hooks/useTerminalMutations";
import { useTerminalStateReconciliation } from "./app/hooks/useTerminalStateReconciliation";
import { useUsageHeatmapPolling } from "./app/hooks/useUsageHeatmapPolling";
import { useWorkspaceSetup } from "./app/hooks/useWorkspaceSetup";
import {
  createTerminalRuntimeStateStore,
  getTerminalRuntimeStateInfo,
  stripTerminalRuntimeState,
  stripTerminalRuntimeStates,
} from "./app/terminalRuntimeStateStore";
import type { TerminalView } from "./app/types";
import { clampSidebarWidth } from "./app/uiStateNormalizers";
import { ActiveAgentsSidebar } from "./components/ActiveAgentsSidebar";
import { ConsoleChromeHeader } from "./components/design-system/ConsoleChromeHeader";
import { PrimaryViewRouter } from "./components/PrimaryViewRouter";
import { SidebarActionPanel } from "./components/SidebarActionPanel";
import { HttpTerminalSnapshotReader } from "./runtime/HttpTerminalSnapshotReader";
import {
  buildTerminalEventsSocketUrl,
  buildTerminalSnapshotsUrl,
} from "./runtime/runtimeEndpoints";

const AppShell = () => {
  const [terminals, setTerminals] = useState<TerminalView>([]);
  const [recentlyCreatedTerminal, setRecentlyCreatedTerminal] = useState<
    TerminalView[number] | null
  >(null);
  const [, setIsLoading] = useState(true);
  const [, setLoadError] = useState<string | null>(null);
  const [hoveredGitHubOverviewPointIndex, setHoveredGitHubOverviewPointIndex] = useState<
    number | null
  >(null);
  const [deckSidebarContent, setDeckSidebarContent] = useState<ReactNode>(null);
  const [conversationsSidebarContent, setConversationsSidebarContent] = useState<ReactNode>(null);
  const [conversationsActionPanel, setConversationsActionPanel] = useState<ReactNode>(null);
  const [promptsSidebarContent, setPromptsSidebarContent] = useState<ReactNode>(null);
  const terminalEventsRefreshTimerRef = useRef<number | null>(null);
  const runtimeStateStoreRef = useRef(createTerminalRuntimeStateStore());
  const runtimeStateStore = runtimeStateStoreRef.current;

  const sortTerminalSnapshots = useCallback(
    (snapshots: TerminalView) =>
      [...snapshots].sort((left, right) => {
        return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      }),
    [],
  );

  const {
    activePrimaryNav,
    setActivePrimaryNav,
    applyHydratedUiState,
    isAgentsSidebarVisible,
    isRuntimeStatusStripVisible,
    isUiStateHydrated,
    readUiState,
    setIsAgentsSidebarVisible,
    setIsRuntimeStatusStripVisible,
    setIsUiStateHydrated,
    setMinimizedTerminalIds,
    setSidebarWidth,
    setTerminalCompletionSound,
    sidebarWidth,
    terminalCompletionSound,
    canvasOpenTerminalIds,
    setCanvasOpenTerminalIds,
    canvasOpenCoordinationIds,
    setCanvasOpenCoordinationIds,
    canvasTerminalsPanelWidth,
    setCanvasTerminalsPanelWidth,
  } = usePersistedUiState({ columns: terminals });
  const {
    workspaceSetup,
    isWorkspaceSetupLoading,
    workspaceSetupError,
    refreshWorkspaceSetup,
    runWorkspaceSetupStep,
  } = useWorkspaceSetup();
  const [runningWorkspaceSetupStepId, setRunningWorkspaceSetupStepId] = useState<
    | "initialize-workspace"
    | "ensure-gitignore"
    | "check-codex"
    | "check-git"
    | "check-curl"
    | "create-coordinations"
    | null
  >(null);

  const readColumns = useCallback(
    async (signal?: AbortSignal) => {
      const readerOptions: { endpoint: string; signal?: AbortSignal } = {
        endpoint: buildTerminalSnapshotsUrl(),
      };
      if (signal) {
        readerOptions.signal = signal;
      }
      const reader = new HttpTerminalSnapshotReader(readerOptions);
      const nextColumns = await buildTerminalList(reader);
      runtimeStateStore.syncFromTerminals(nextColumns);
      return stripTerminalRuntimeStates(nextColumns);
    },
    [runtimeStateStore],
  );

  const refreshColumns = useCallback(async () => {
    const nextColumns = await readColumns();
    setTerminals(nextColumns);
    return nextColumns;
  }, [readColumns]);

  const {
    clearPendingDeleteTerminal,
    closeTerminal,
    confirmDeleteTerminal,
    createTerminal,
    isDeletingTerminalId,
    pendingDeleteTerminal,
    requestDeleteTerminal,
  } = useTerminalMutations({
    readColumns: async () => readColumns(),
    setColumns: setTerminals,
    setLoadError,
    setMinimizedTerminalIds,
  });

  const {
    openGitOrchestrationId,
    openGitOrchestrationStatus,
    openGitOrchestrationPullRequest,
    gitCommitMessageDraft,
    gitDialogError,
    isGitDialogLoading,
    isGitDialogMutating,
    setGitCommitMessageDraft,
    closeOrchestrationGitActions,
    commitOrchestrationChanges,
    commitAndPushOrchestrationBranch,
    pushOrchestrationBranch,
    syncOrchestrationBranch,
    mergeOrchestrationPullRequest,
    gitStatusByOrchestrationId,
  } = useOrchestrationGitLifecycle({
    columns: terminals,
  });

  useInitialColumnsHydration({
    readColumns,
    readUiState,
    applyHydratedUiState,
    setColumns: setTerminals,
    setLoadError,
    setIsLoading,
    setIsUiStateHydrated,
  });

  useEffect(() => {
    return () => {
      if (terminalEventsRefreshTimerRef.current !== null) {
        window.clearTimeout(terminalEventsRefreshTimerRef.current);
        terminalEventsRefreshTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const socket = new WebSocket(buildTerminalEventsSocketUrl());

    socket.addEventListener("message", (event) => {
      if (typeof event.data !== "string") {
        return;
      }

      try {
        const payload = JSON.parse(event.data) as
          | {
              type?: unknown;
              snapshot?: TerminalSnapshot;
              terminalId?: string;
              agentRuntimeState?: string;
              toolName?: string;
            }
          | undefined;
        if (!payload || typeof payload.type !== "string") {
          return;
        }

        if (payload.type === "terminal-created" || payload.type === "terminal-updated") {
          if (!payload.snapshot) {
            return;
          }
          const runtimeState = getTerminalRuntimeStateInfo(payload.snapshot);
          runtimeStateStore.setRuntimeState(payload.snapshot.terminalId, runtimeState);
          const structuralSnapshot = stripTerminalRuntimeState(payload.snapshot);
          if (payload.type === "terminal-created") {
            setRecentlyCreatedTerminal(structuralSnapshot as TerminalView[number]);
          }
          setTerminals((current) =>
            sortTerminalSnapshots([
              ...current.filter(
                (terminal) => terminal.terminalId !== structuralSnapshot.terminalId,
              ),
              structuralSnapshot,
            ]),
          );
          return;
        }

        if (payload.type === "terminal-state-changed") {
          if (!payload.terminalId || !isAgentRuntimeState(payload.agentRuntimeState)) {
            return;
          }
          runtimeStateStore.setRuntimeState(payload.terminalId, {
            state: payload.agentRuntimeState,
            ...(payload.toolName ? { toolName: payload.toolName } : {}),
          });
          return;
        }

        if (payload.type === "terminal-deleted") {
          if (!payload.terminalId) {
            return;
          }
          runtimeStateStore.removeTerminal(payload.terminalId);
          setTerminals((current) =>
            current.filter((terminal) => terminal.terminalId !== payload.terminalId),
          );
          return;
        }

        if (payload.type !== "terminal-list-changed") {
          return;
        }
      } catch {
        return;
      }

      if (terminalEventsRefreshTimerRef.current !== null) {
        window.clearTimeout(terminalEventsRefreshTimerRef.current);
      }
      terminalEventsRefreshTimerRef.current = window.setTimeout(() => {
        terminalEventsRefreshTimerRef.current = null;
        void refreshColumns();
      }, 100);
    });

    return () => {
      if (terminalEventsRefreshTimerRef.current !== null) {
        window.clearTimeout(terminalEventsRefreshTimerRef.current);
        terminalEventsRefreshTimerRef.current = null;
      }
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      } else if (socket.readyState === WebSocket.CONNECTING) {
        socket.addEventListener("open", () => socket.close(), { once: true });
      }
    };
  }, [refreshColumns, runtimeStateStore, sortTerminalSnapshots]);

  const { agentProvider, setAgentProvider } = useAgentProviderPreference();
  const { colorTheme, isLight, setColorTheme, toggleColorTheme } = useColorThemeContext();
  const { codexUsageSnapshot, isRefreshingCodexUsage, refreshCodexUsage } = useCodexUsagePolling();
  useBackendLivenessPolling();
  const { githubRepoSummary, isRefreshingGitHubSummary, refreshGitHubRepoSummary } =
    useGithubSummaryPolling();
  const handleActiveTerminalIdsChange = useCallback(
    (activeTerminalIds: ReadonlySet<string>) => {
      runtimeStateStore.retainTerminalIds(activeTerminalIds);
    },
    [runtimeStateStore],
  );

  useTerminalStateReconciliation({
    columns: terminals,
    setMinimizedTerminalIds,
    onActiveTerminalIdsChange: handleActiveTerminalIdsChange,
  });
  const { playCompletionSoundPreview } = useTerminalCompletionNotification(
    runtimeStateStore,
    terminalCompletionSound,
  );
  const { heatmapData, isLoadingHeatmap, refreshHeatmap } = useUsageHeatmapPolling({
    enabled: isUiStateHydrated && (activePrimaryNav === 3 || isRuntimeStatusStripVisible),
  });

  useConsoleKeyboardShortcuts({ setActivePrimaryNav });

  const {
    githubCommitCount30d,
    sparklinePoints,
    githubOverviewGraphSeries,
    githubOverviewGraphPolylinePoints,
    githubOverviewHoverLabel,
    githubStatusPill,
    githubRepoLabel,
    githubStarCountLabel,
    githubOpenIssuesLabel,
    githubOpenPrsLabel,
    githubRecentCommits,
  } = useGitHubPrimaryViewModel({
    githubRepoSummary,
    hoveredGitHubOverviewPointIndex,
    setHoveredGitHubOverviewPointIndex,
  });
  const hasSidebarActionPanel =
    conversationsActionPanel !== null ||
    pendingDeleteTerminal !== null ||
    (openGitOrchestrationId !== null &&
      terminals.find((terminal) => terminal.coordinationId === openGitOrchestrationId)
        ?.workspaceMode === "worktree");

  const sidebarActionPanel = hasSidebarActionPanel ? (
    conversationsActionPanel ? (
      <>{conversationsActionPanel}</>
    ) : (
      <SidebarActionPanel
        pendingDeleteTerminal={pendingDeleteTerminal}
        isDeletingTerminalId={isDeletingTerminalId}
        clearPendingDeleteTerminal={clearPendingDeleteTerminal}
        confirmDeleteTerminal={confirmDeleteTerminal}
        openGitOrchestrationId={openGitOrchestrationId}
        columns={terminals}
        openGitOrchestrationStatus={openGitOrchestrationStatus}
        openGitOrchestrationPullRequest={openGitOrchestrationPullRequest}
        gitCommitMessageDraft={gitCommitMessageDraft}
        gitDialogError={gitDialogError}
        isGitDialogLoading={isGitDialogLoading}
        isGitDialogMutating={isGitDialogMutating}
        setGitCommitMessageDraft={setGitCommitMessageDraft}
        closeOrchestrationGitActions={closeOrchestrationGitActions}
        commitOrchestrationChanges={commitOrchestrationChanges}
        commitAndPushOrchestrationBranch={commitAndPushOrchestrationBranch}
        pushOrchestrationBranch={pushOrchestrationBranch}
        syncOrchestrationBranch={syncOrchestrationBranch}
        mergeOrchestrationPullRequest={mergeOrchestrationPullRequest}
        requestDeleteTerminal={requestDeleteTerminal}
      />
    )
  ) : null;

  useEffect(() => {
    if (!hasSidebarActionPanel || isAgentsSidebarVisible) {
      return;
    }
    setIsAgentsSidebarVisible(true);
  }, [isAgentsSidebarVisible, setIsAgentsSidebarVisible, hasSidebarActionPanel]);

  const handleTerminalRenamed = useCallback((terminalId: string, coordinationName: string) => {
    setTerminals((current) =>
      current.map((t) =>
        t.terminalId === terminalId ? { ...t, coordinationName, label: coordinationName } : t,
      ),
    );
  }, []);

  const handleTerminalActivity = useCallback((terminalId: string) => {
    setTerminals((current) =>
      current.map((t) => (t.terminalId === terminalId ? { ...t, hasUserPrompt: true } : t)),
    );
  }, []);

  const handleRunWorkspaceSetupStep = useCallback(
    async (
      stepId:
        | "initialize-workspace"
        | "ensure-gitignore"
        | "check-codex"
        | "check-git"
        | "check-curl"
        | "create-coordinations",
    ) => {
      setRunningWorkspaceSetupStepId(stepId);
      try {
        await runWorkspaceSetupStep(stepId);
      } finally {
        setRunningWorkspaceSetupStepId(null);
      }
    },
    [runWorkspaceSetupStep],
  );

  const showAgentsSidebar =
    isAgentsSidebarVisible &&
    activePrimaryNav !== 1 &&
    activePrimaryNav !== 3 &&
    activePrimaryNav !== 4 &&
    activePrimaryNav !== 8;

  return (
    <div className={cn("page console-shell design-console", isLight && "light")}>
      <ConsoleChromeHeader
        activePrimaryNav={activePrimaryNav}
        onPrimaryNavChange={setActivePrimaryNav}
        agentProvider={agentProvider}
        onAgentProviderChange={setAgentProvider}
        codexUsage={codexUsageSnapshot}
        isRefreshingCodexUsage={isRefreshingCodexUsage}
        isLight={isLight}
        onToggleColorTheme={toggleColorTheme}
      />

      <section className="console-main-canvas" aria-label="Main content canvas">
        <div className={cn("workspace-shell", !showAgentsSidebar && "workspace-shell--full")}>
          {showAgentsSidebar && (
              <ActiveAgentsSidebar
                sidebarWidth={sidebarWidth}
                onSidebarWidthChange={(width) => {
                  setSidebarWidth(clampSidebarWidth(width));
                }}
                actionPanel={sidebarActionPanel}
                bodyContent={
                  activePrimaryNav === 2
                    ? (deckSidebarContent ?? undefined)
                    : activePrimaryNav === 6
                      ? (conversationsSidebarContent ?? undefined)
                      : activePrimaryNav === 7
                        ? (promptsSidebarContent ?? undefined)
                        : undefined
                }
              />
            )}

          <PrimaryViewRouter
            activePrimaryNav={activePrimaryNav}
            deckPrimaryViewProps={{
              onSidebarContent: setDeckSidebarContent,
              workspaceSetup,
              isWorkspaceSetupLoading,
              workspaceSetupError,
              onRefreshWorkspaceSetup: refreshWorkspaceSetup,
              onRunWorkspaceSetupStep: runWorkspaceSetupStep,
              suppressWorkspaceSetupCard: true,
            }}
            activityPrimaryViewProps={{
              usageChartProps: {
                data: heatmapData,
                isLoading: isLoadingHeatmap,
                onRefresh: refreshHeatmap,
              },
              githubPrimaryViewProps: {
                githubCommitCount30d,
                githubOpenIssuesLabel,
                githubOpenPrsLabel,
                githubRecentCommits,
                githubOverviewGraphPolylinePoints,
                githubOverviewGraphSeries,
                githubOverviewHoverLabel,
                githubRepoLabel,
                githubStarCountLabel,
                githubStatusPill,
                hoveredGitHubOverviewPointIndex,
                isRefreshingGitHubSummary,
                onHoveredGitHubOverviewPointIndexChange: setHoveredGitHubOverviewPointIndex,
                onRefresh: () => {
                  void refreshGitHubRepoSummary();
                },
              },
            }}
            settingsPrimaryViewProps={{
              colorTheme,
              onColorThemeChange: setColorTheme,
              isRuntimeStatusStripVisible,
              onRuntimeStatusStripVisibilityChange: setIsRuntimeStatusStripVisible,
              onPreviewTerminalCompletionSound: playCompletionSoundPreview,
              onTerminalCompletionSoundChange: setTerminalCompletionSound,
              terminalCompletionSound,
            }}
            canvasPrimaryViewProps={{
              columns: terminals,
              runtimeStateStore,
              isUiStateHydrated,
              recentlyCreatedTerminal,
              canvasOpenTerminalIds,
              canvasOpenCoordinationIds,
              canvasTerminalsPanelWidth,
              workspaceSetup,
              isWorkspaceSetupLoading,
              workspaceSetupError,
              runningWorkspaceSetupStepId,
              onRunWorkspaceSetupStep: handleRunWorkspaceSetupStep,
              onLaunchWorkspaceSetupPlanner: async () => {
                const response = await fetch("/api/terminals", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name: "coordination-planner",
                    workspaceMode: "shared",
                    agentProvider,
                    promptTemplate: "coordination-planner",
                  }),
                });
                if (!response.ok) {
                  return undefined;
                }
                const snapshot = (await response.json()) as { terminalId?: string };
                await refreshColumns();
                if (typeof snapshot.terminalId !== "string") {
                  return undefined;
                }
                return snapshot.terminalId;
              },
              onCanvasOpenTerminalIdsChange: setCanvasOpenTerminalIds,
              onCanvasOpenOrchestrationIdsChange: setCanvasOpenCoordinationIds,
              onCanvasTerminalsPanelWidthChange: setCanvasTerminalsPanelWidth,
              onCreateAgent: async (coordinationId) => {
                return await createTerminal("shared", agentProvider, coordinationId);
              },
              onCreateTerminal: async () => {
                return await createTerminal("shared", agentProvider, DECK_LEAD_ID);
              },
              onCreateWorktreeTerminal: async () => {
                return await createTerminal("worktree", agentProvider, DECK_LEAD_ID);
              },
              onCreateOrchestration: async () => {
                const response = await fetch("/api/deck/coordinations", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: "", description: "" }),
                });
                if (!response.ok) return;
                await refreshColumns();
              },
              onSpawnSwarm: async (coordinationId, workspaceMode) => {
                const response = await fetch(
                  `/api/deck/coordinations/${encodeURIComponent(coordinationId)}/swarm`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ workspaceMode }),
                  },
                );
                if (!response.ok) {
                  let message = "Failed to spawn swarm.";
                  try {
                    const body = (await response.json()) as { error?: unknown };
                    if (typeof body.error === "string" && body.error.trim().length > 0) {
                      message = body.error;
                    }
                  } catch {
                    // Fall back to the generic message when the server returns a non-JSON error.
                  }
                  throw new Error(message);
                }
                await refreshColumns();
              },
              onDeckLeadAction: async (action) => {
                const response = await fetch("/api/terminals", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    workspaceMode: "shared",
                    coordinationId: DECK_LEAD_ID,
                    promptTemplate: action,
                  }),
                });
                if (!response.ok) return undefined;
                const snapshot = (await response.json()) as { terminalId?: string };
                await refreshColumns();
                return typeof snapshot.terminalId === "string" ? snapshot.terminalId : undefined;
              },
              onOrchestrationAction: async (coordinationId, action) => {
                const response = await fetch("/api/terminals", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    workspaceMode: "shared",
                    coordinationId,
                    promptTemplate: action,
                    promptVariables: {
                      coordinationId,
                    },
                  }),
                });
                if (!response.ok) return undefined;
                const snapshot = (await response.json()) as { terminalId?: string };
                await refreshColumns();
                return typeof snapshot.terminalId === "string" ? snapshot.terminalId : undefined;
              },
              onNavigateToConversation: (_sessionId) => {
                setActivePrimaryNav(6);
              },
              onCloseActiveSession: (terminalId) => closeTerminal(terminalId),
              onDeleteActiveSession: (terminalId, terminalName, workspaceMode) => {
                requestDeleteTerminal(terminalId, terminalName, {
                  workspaceMode: workspaceMode === "worktree" ? "worktree" : "shared",
                  intent: "delete-terminal",
                });
              },
              pendingDeleteTerminal,
              isDeletingTerminalId,
              onCancelDelete: clearPendingDeleteTerminal,
              onConfirmDelete: () => {
                void confirmDeleteTerminal();
              },
              onTerminalRenamed: handleTerminalRenamed,
              onTerminalActivity: handleTerminalActivity,
              onRefreshColumns: async () => {
                await refreshColumns();
              },
              gitStatusByOrchestrationId,
              codexUsage: codexUsageSnapshot,
            }}
            conversationsEnabled={isUiStateHydrated && activePrimaryNav === 6}
            onConversationsSidebarContent={setConversationsSidebarContent}
            onConversationsActionPanel={setConversationsActionPanel}
            promptsEnabled={isUiStateHydrated && activePrimaryNav === 7}
            onPromptsSidebarContent={setPromptsSidebarContent}
          />
        </div>
      </section>

    </div>
  );
};

export const App = (): React.ReactElement => (
  <ColorThemeProvider>
    <AppShell />
  </ColorThemeProvider>
);
