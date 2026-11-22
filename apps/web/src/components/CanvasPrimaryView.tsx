import { isFunctionValue } from "@adadex/core";
import type { WorkspaceSetupSnapshot, WorkspaceSetupStepId } from "@adadex/core";
import { ChevronUp, ListTodo } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { answerApproval } from "../app/answerApproval";
import type { GraphNode } from "../app/canvas/types";
import { useAgentRuntimeStates } from "../app/hooks/useAgentRuntimeStates";
import { useCanvasGraphData } from "../app/hooks/useCanvasGraphData";
import { useCanvasTransform } from "../app/hooks/useCanvasTransform";
import { useForceSimulation } from "../app/hooks/useForceSimulation";
import type { PendingDeleteTerminal } from "../app/hooks/useTerminalMutations";
import { useWorkspaceSetupOverlay } from "../app/hooks/useWorkspaceSetupOverlay";
import {
  createTerminalRuntimeStateStore,
  type TerminalRuntimeStateStore,
} from "../app/terminalRuntimeStateStore";
import type {
  CoordinationGitStatusSnapshot,
  TerminalView,
  TerminalWorkspaceMode,
} from "../app/types";
import { CanvasContextMenu } from "./canvas/CanvasContextMenu";
import { CanvasOrchestrationPanel } from "./canvas/CanvasOrchestrationPanel";
import {
  type ContextMenuState,
  CLICK_THRESHOLD,
  GRAPH_MIN_WIDTH,
  TERMINAL_MIN_WIDTH,
  ACTIVE_SESSION_RADIUS,
  buildActiveSessionNodeId,
  buildOrchestrationNodeId,
  buildCanvasEdgePath,
  reconcileOpenTerminalNodes,
  isEdgeActivityVisible,
  renderEdgeActivityDots,
} from "./canvas/canvasSupport";
import { CanvasTerminalColumn } from "./canvas/CanvasTerminalColumn";
import { DeleteAllTerminalsDialog } from "./canvas/DeleteAllTerminalsDialog";
import { MascotNode } from "./canvas/MascotNode";
import { SessionNode } from "./canvas/SessionNode";
import { WorkspaceSetupCard } from "./deck/WorkspaceSetupCard";
import { DeleteOrchestrationDialog } from "./DeleteOrchestrationDialog";
import { ConsoleCanvasViewportControls } from "./design-system/ConsoleCanvasViewportControls";
import { ConsoleChromeToolbar } from "./design-system/ConsoleChromeToolbar";
import { ConsoleInspectorPanel } from "./design-system/ConsoleInspectorPanel";
import { ThreadTree } from "./ThreadTree";

export type CanvasPrimaryViewProps = {
  columns: TerminalView;
  runtimeStateStore?: TerminalRuntimeStateStore;
  isUiStateHydrated?: boolean;
  canvasOpenTerminalIds?: string[];
  canvasOpenCoordinationIds?: string[];
  canvasTerminalsPanelWidth?: number | null;
  workspaceSetup?: WorkspaceSetupSnapshot | null;
  isWorkspaceSetupLoading?: boolean;
  workspaceSetupError?: string | null;
  runningWorkspaceSetupStepId?: WorkspaceSetupStepId | null;
  onRunWorkspaceSetupStep?: (stepId: WorkspaceSetupStepId) => Promise<void> | void;
  onLaunchWorkspaceSetupPlanner?: () => Promise<string | undefined> | undefined;
  recentlyCreatedTerminal?: TerminalView[number] | null;
  onCanvasOpenTerminalIdsChange?: (ids: string[]) => void;
  onCanvasOpenOrchestrationIdsChange?: (ids: string[]) => void;
  onCanvasTerminalsPanelWidthChange?: (width: number | null) => void;
  onCreateAgent?:
    | ((coordinationId: string, parentTerminalId?: string) => Promise<string | undefined>)
    | undefined;
  onCreateTerminal?: () => Promise<string | undefined> | undefined;
  onCreateWorktreeTerminal?: () => Promise<string | undefined> | undefined;
  onCreateOrchestration?: () => void;
  onSpawnSwarm?: (coordinationId: string, workspaceMode: TerminalWorkspaceMode) => Promise<void>;
  onSolveTodoItem?: (coordinationId: string, itemIndex: number) => Promise<void> | void;
  onDeckLeadAction?: (action: string) => Promise<string | undefined> | undefined;
  onOrchestrationAction?: (
    coordinationId: string,
    action: string,
  ) => Promise<string | undefined> | undefined;
  onNavigateToConversation?: (sessionId: string) => void;
  onCloseActiveSession?: (
    terminalId: string,
    terminalName: string,
    workspaceMode?: string,
  ) => boolean | Promise<boolean> | undefined;
  onDeleteActiveSession?: (
    terminalId: string,
    terminalName: string,
    workspaceMode?: string,
  ) => void;
  pendingDeleteTerminal?: PendingDeleteTerminal | null;
  isDeletingTerminalId?: string | null;
  onCancelDelete?: () => void;
  onConfirmDelete?: () => void;
  onTerminalRenamed?: ((terminalId: string, coordinationName: string) => void) | undefined;
  onTerminalActivity?: ((terminalId: string) => void) | undefined;
  onRefreshColumns?: () => Promise<void> | void;
  onOpenGitActions?: (coordinationId: string) => void;
  gitStatusByOrchestrationId?: Record<string, CoordinationGitStatusSnapshot>;
};

export const CanvasPrimaryView = ({
  columns,
  runtimeStateStore: providedRuntimeStateStore,
  isUiStateHydrated,
  canvasOpenTerminalIds,
  canvasOpenCoordinationIds,
  canvasTerminalsPanelWidth: persistedTerminalsPanelWidth,
  workspaceSetup = null,
  isWorkspaceSetupLoading = false,
  workspaceSetupError = null,
  runningWorkspaceSetupStepId = null,
  onRunWorkspaceSetupStep,
  onLaunchWorkspaceSetupPlanner,
  recentlyCreatedTerminal,
  onCanvasOpenTerminalIdsChange,
  onCanvasOpenOrchestrationIdsChange,
  onCanvasTerminalsPanelWidthChange,
  onCreateAgent,
  onCreateTerminal,
  onCreateWorktreeTerminal,
  onCreateOrchestration,
  onSpawnSwarm,
  onSolveTodoItem,
  onDeckLeadAction,
  onOrchestrationAction,
  onNavigateToConversation,
  onCloseActiveSession,
  onDeleteActiveSession,
  pendingDeleteTerminal,
  isDeletingTerminalId,
  onCancelDelete,
  onConfirmDelete,
  onTerminalRenamed,
  onTerminalActivity,
  onRefreshColumns,
  gitStatusByOrchestrationId = {},
}: CanvasPrimaryViewProps) => {
  const [initialRuntimeStateStore] = useState(
    () => providedRuntimeStateStore ?? createTerminalRuntimeStateStore(),
  );

  const runtimeStateStore = providedRuntimeStateStore ?? initialRuntimeStateStore;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);
  const [openTerminals, setOpenTerminals] = useState<Map<string, GraphNode>>(new Map());
  const [openOrchestrations, setOpenOrchestrations] = useState<Map<string, GraphNode>>(new Map());
  const [hasTerminalHydrationSettled, setHasTerminalHydrationSettled] = useState(false);
  const [hasRestoredPersistedTerminals, setHasRestoredPersistedTerminals] = useState(false);
  const [hasHydratedOrchestrations, setHasHydratedOrchestrations] = useState(false);
  const [reconciledColumns, setReconciledColumns] = useState(columns);
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [terminalsPanelWidth, setTerminalsPanelWidth] = useState<number | null>(null);
  const [pendingOpenAgentId, setPendingOpenAgentId] = useState<string | null>(null);
  const [hideIdleTerminals, setHideIdleTerminals] = useState(false);
  const [isLaunchingWorkspaceSetupPlanner, setIsLaunchingWorkspaceSetupPlanner] = useState(false);

  const [lastHandledCreatedTerminalId, setLastHandledCreatedTerminalId] = useState<string | null>(
    null,
  );

  const hasHydratedTerminals = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const nodeClickedRef = useRef(false);
  const dividerDragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const containerRef = useRef<HTMLElement>(null);
  const terminalsPanelRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef(new Map<string, HTMLElement>());
  const lastFocusedPanelIdRef = useRef<string | null>(null);

  const {
    shouldShow: shouldShowWorkspaceSetupCard,
    overlay: visibleWorkspaceSetupOverlay,
    setOverlay: setWorkspaceSetupOverlay,
    incompleteSteps: incompleteWorkspaceSetupSteps,
  } = useWorkspaceSetupOverlay(workspaceSetup);

  const agentRuntimeStates = useAgentRuntimeStates(runtimeStateStore, columns);

  const {
    nodes,
    edges,
    orchestrationById,
    sessionsByOrchestrationId,
    refresh: refreshGraphData,
    refreshDeckOrchestrations,
  } = useCanvasGraphData({ columns, enabled: true, agentRuntimeStates });

  const {
    transform,
    isPanning,
    svgRef,
    handleWheel,
    handlePointerDown: handleCanvasPointerDown,
    handlePointerMove: handleCanvasPointerMove,
    handlePointerUp: handleCanvasPointerUp,
    screenToGraph,
    fitAll,
    zoomIn,
    zoomOut,
  } = useCanvasTransform();

  const [showCanvasGrid, setShowCanvasGrid] = useState(true);

  const { simulatedNodes, pinNode, unpinNode, moveNode, reheat } = useForceSimulation({
    nodes,
    edges,
    centerX: 0,
    centerY: 0,
  });

  const nodesById = useMemo(() => {
    const map = new Map<string, GraphNode>();

    for (const n of simulatedNodes) {
      map.set(n.id, n);
    }

    return map;
  }, [simulatedNodes]);

  const resolveActiveSessionNode = useCallback(
    (terminalId: string): GraphNode | null => {
      const nodeId = buildActiveSessionNodeId(terminalId);
      const existingNode = nodesById.get(nodeId);
      const terminal = columns.find((entry) => entry.terminalId === terminalId);

      if (!terminal) {
        return existingNode?.type === "active-session" ? existingNode : null;
      }

      const parentNodeId = terminal.parentTerminalId
        ? buildActiveSessionNodeId(terminal.parentTerminalId)
        : buildOrchestrationNodeId(terminal.coordinationId);

      const anchorNode =
        existingNode?.type === "active-session"
          ? existingNode
          : (nodesById.get(parentNodeId) ??
            nodesById.get(buildOrchestrationNodeId(terminal.coordinationId)));

      const nextNode: GraphNode = {
        id: nodeId,
        type: "active-session",
        x: anchorNode?.x ?? 0,
        y: anchorNode?.y ?? 0,
        vx: 0,
        vy: 0,
        pinned: false,
        radius: ACTIVE_SESSION_RADIUS,
        coordinationId: terminal.coordinationId,
        label: terminal.coordinationName || terminal.label || terminal.terminalId,
        color: anchorNode?.color ?? "#c0c0c0",
        sessionId: terminal.terminalId,
        agentState: terminal.state,
        hasUserPrompt: terminal.hasUserPrompt ?? false,
      };

      if (terminal.workspaceMode) nextNode.workspaceMode = terminal.workspaceMode;

      if (terminal.parentTerminalId) nextNode.parentTerminalId = terminal.parentTerminalId;

      return nextNode;
    },
    [columns, nodesById],
  );

  const hasPersistedTerminalIds = Boolean(
    canvasOpenTerminalIds && canvasOpenTerminalIds.length > 0,
  );

  const isHydratingTerminals = Boolean(
    isUiStateHydrated && hasPersistedTerminalIds && !hasTerminalHydrationSettled,
  );

  const openTerminalCount = openTerminals.size;

  if (
    !hasRestoredPersistedTerminals &&
    isUiStateHydrated &&
    hasPersistedTerminalIds &&
    hasTerminalHydrationSettled &&
    openTerminalCount === 0
  ) {
    setHasRestoredPersistedTerminals(true);

    const restoredMap = new Map<string, GraphNode>();

    for (const nodeId of canvasOpenTerminalIds ?? []) {
      const node = nodesById.get(nodeId);

      if (node && node.type === "active-session") {
        restoredMap.set(nodeId, { ...node });
      }
    }

    if (restoredMap.size > 0) {
      setOpenTerminals(restoredMap);
    }

    if (persistedTerminalsPanelWidth != null && persistedTerminalsPanelWidth > 0) {
      setTerminalsPanelWidth(persistedTerminalsPanelWidth);
    }
  }

  useEffect(() => {
    if (hasHydratedTerminals.current) return;

    if (!isUiStateHydrated) return;

    if (!canvasOpenTerminalIds || canvasOpenTerminalIds.length === 0) {
      hasHydratedTerminals.current = true;

      return;
    }

    const timer = window.setTimeout(() => {
      hasHydratedTerminals.current = true;
      setHasTerminalHydrationSettled(true);
    }, 800);

    return () => window.clearTimeout(timer);
  }, [isUiStateHydrated, canvasOpenTerminalIds]);

  useEffect(() => {
    if (!hasHydratedTerminals.current) return;
    onCanvasOpenTerminalIdsChange?.(Array.from(openTerminals.keys()));
  }, [openTerminals, onCanvasOpenTerminalIdsChange]);

  if (reconciledColumns !== columns) {
    setReconciledColumns(columns);
    setOpenTerminals((current) => reconcileOpenTerminalNodes(current, columns));
  }

  const hasOrchestrationNodes = simulatedNodes.some((n) => n.type === "orchestration");
  const openOrchestrationCount = openOrchestrations.size;

  if (!hasHydratedOrchestrations && isUiStateHydrated && hasOrchestrationNodes) {
    setHasHydratedOrchestrations(true);

    if (canvasOpenCoordinationIds && canvasOpenCoordinationIds.length > 0) {
      const restoredMap = new Map<string, GraphNode>();

      for (const nodeId of canvasOpenCoordinationIds) {
        const node = nodesById.get(nodeId);

        if (node && (node.type === "orchestration" || node.type === "deck-lead")) {
          restoredMap.set(nodeId, { ...node });
        }
      }

      if (restoredMap.size > 0) {
        setOpenOrchestrations(restoredMap);
      }
    }
  }

  useEffect(() => {
    if (!hasHydratedOrchestrations) return;
    onCanvasOpenOrchestrationIdsChange?.(Array.from(openOrchestrations.keys()));
  }, [openOrchestrations, hasHydratedOrchestrations, onCanvasOpenOrchestrationIdsChange]);

  useEffect(() => {
    if (!hasHydratedTerminals.current) return;

    if (terminalsPanelWidth == null) return;
    onCanvasTerminalsPanelWidthChange?.(terminalsPanelWidth);
  }, [terminalsPanelWidth, onCanvasTerminalsPanelWidthChange]);

  const handleNodePointerDown = useCallback(
    (e: React.PointerEvent, nodeId: string) => {
      if (e.button !== 0) return;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      setDragNodeId(nodeId);
      pinNode(nodeId);
      svgRef.current?.setPointerCapture(e.pointerId);
    },
    [pinNode, svgRef],
  );

  const handleSvgPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (dragNodeId) {
        const graphPos = screenToGraph(e.clientX, e.clientY);
        moveNode(dragNodeId, graphPos.x, graphPos.y);

        return;
      }

      handleCanvasPointerMove(e);
    },
    [dragNodeId, screenToGraph, moveNode, handleCanvasPointerMove],
  );

  const openTerminalFor = useCallback(
    (terminalId: string) => {
      const nodeId = buildActiveSessionNodeId(terminalId);
      const node = nodesById.get(nodeId);

      if (!node) return;

      const resolvedNode = node.sessionId
        ? (resolveActiveSessionNode(node.sessionId) ?? node)
        : node;

      setSelectedNodeId(nodeId);
      setOpenTerminals((prev) =>
        prev.has(nodeId) ? prev : new Map(prev).set(nodeId, { ...resolvedNode }),
      );
    },
    [nodesById, resolveActiveSessionNode],
  );

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      const node = nodesById.get(nodeId);

      if (!node) return;

      if (node.type === "active-session") {
        const resolvedNode = node.sessionId
          ? (resolveActiveSessionNode(node.sessionId) ?? node)
          : node;

        setOpenTerminals((prev) => {
          const next = new Map(prev);

          if (next.has(nodeId)) {
            next.delete(nodeId);
          } else {
            next.set(nodeId, { ...resolvedNode });
          }

          return next;
        });
      } else if (node.type === "orchestration" || node.type === "deck-lead") {
        setOpenOrchestrations((prev) => {
          const next = new Map(prev);

          if (next.has(nodeId)) {
            next.delete(nodeId);
          } else {
            next.set(nodeId, { ...node });
          }

          return next;
        });
      } else if (node.type === "inactive-session" && node.sessionId) {
        onNavigateToConversation?.(node.sessionId);
      }
    },
    [nodesById, onNavigateToConversation, resolveActiveSessionNode],
  );

  const setPanelRef = useCallback(
    (nodeId: string) => (element: HTMLElement | null) => {
      if (element) {
        panelRefs.current.set(nodeId, element);

        return;
      }

      panelRefs.current.delete(nodeId);
    },
    [],
  );

  const handlePanelFocus = useCallback((nodeId: string) => {
    lastFocusedPanelIdRef.current = nodeId;
    setSelectedNodeId(nodeId);
  }, []);

  const handleCloseOrchestration = useCallback((nodeId: string) => {
    setOpenOrchestrations((prev) => {
      const next = new Map(prev);
      next.delete(nodeId);

      return next;
    });
    setSelectedNodeId((prev) => (prev === nodeId ? null : prev));
  }, []);

  const handleMinimizeTerminal = useCallback((nodeId: string) => {
    setOpenTerminals((prev) => {
      const next = new Map(prev);
      next.delete(nodeId);

      return next;
    });
    setSelectedNodeId((prev) => (prev === nodeId ? null : prev));
  }, []);

  const handleCloseTerminal = useCallback(
    (node: GraphNode) => {
      if (!node.sessionId) {
        return;
      }

      const closePanel = () => {
        setOpenTerminals((prev) => {
          const next = new Map(prev);
          next.delete(node.id);

          return next;
        });
        setSelectedNodeId((prev) => (prev === node.id ? null : prev));
      };

      closePanel();

      const terminal = columns.find((entry) => entry.terminalId === node.sessionId);
      void onCloseActiveSession?.(
        node.sessionId,
        terminal?.coordinationName ?? node.label,
        terminal?.workspaceMode ?? node.workspaceMode,
      );
    },
    [columns, onCloseActiveSession],
  );

  const handleDividerPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();

      const panelEl =
        /* SAFETY: preceding checks establish the invariant this assertion encodes. */ /* SAFETY: preceding checks establish the invariant this assertion encodes. */ (
          e.target as HTMLElement
        ).nextElementSibling as HTMLElement | null;

      const currentWidth = panelEl?.clientWidth ?? terminalsPanelWidth ?? 600;
      dividerDragRef.current = { startX: e.clientX, startWidth: currentWidth };
      /* SAFETY: preceding checks establish the invariant this assertion encodes. */ (
        e.target as HTMLElement
      ).setPointerCapture(e.pointerId);
    },
    [terminalsPanelWidth],
  );

  const handleDividerPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dividerDragRef.current;

    if (!drag) return;
    const containerWidth = containerRef.current?.clientWidth ?? 1200;
    const delta = drag.startX - e.clientX;

    const newWidth = Math.max(
      TERMINAL_MIN_WIDTH,
      Math.min(containerWidth - GRAPH_MIN_WIDTH - 6, drag.startWidth + delta),
    );

    setTerminalsPanelWidth(newWidth);
  }, []);

  const handleDividerPointerUp = useCallback(() => {
    dividerDragRef.current = null;
  }, []);

  useEffect(() => {
    if (!isHydratingTerminals && openTerminalCount === 0 && openOrchestrationCount === 0) return;
    const panel = terminalsPanelRef.current;

    if (!panel) return;

    const handler = (e: WheelEvent) => {
      const target =
        /* SAFETY: preceding checks establish the invariant this assertion encodes. */ e.target as Element | null;

      if (!target?.closest(".canvas-terminal-column-header")) return;

      if (e.deltaY !== 0 && e.deltaX === 0) {
        e.preventDefault();
        panel.scrollLeft += e.deltaY;
      }
    };

    panel.addEventListener("wheel", handler, { passive: false });

    return () => panel.removeEventListener("wheel", handler);
  }, [isHydratingTerminals, openTerminalCount, openOrchestrationCount]);

  const handleSvgPointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (dragNodeId) {
        const start = dragStartRef.current;
        const dx = start ? e.clientX - start.x : Number.POSITIVE_INFINITY;
        const dy = start ? e.clientY - start.y : Number.POSITIVE_INFINITY;
        const wasClick = Math.abs(dx) < CLICK_THRESHOLD && Math.abs(dy) < CLICK_THRESHOLD;

        unpinNode(dragNodeId);
        reheat();

        if (wasClick) {
          nodeClickedRef.current = true;
          handleNodeClick(dragNodeId);
        }

        setDragNodeId(null);
        dragStartRef.current = null;

        return;
      }

      handleCanvasPointerUp(e);
    },
    [dragNodeId, unpinNode, reheat, handleCanvasPointerUp, handleNodeClick],
  );

  const handleSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (nodeClickedRef.current) {
      nodeClickedRef.current = false;

      return;
    }

    if (e.target === e.currentTarget) {
      setSelectedNodeId(null);
    }
  }, []);

  const nodesByIdRef = useRef(nodesById);
  const onNavigateRef = useRef(onNavigateToConversation);

  useEffect(() => {
    nodesByIdRef.current = nodesById;
    onNavigateRef.current = onNavigateToConversation;
  }, [nodesById, onNavigateToConversation]);

  useEffect(() => {
    const svg = svgRef.current;

    if (!svg) return;

    const handler = (e: MouseEvent) => {
      let el =
        /* SAFETY: preceding checks establish the invariant this assertion encodes. */ e.target as Element | null;

      let nodeId: string | null = null;

      while (el && el !== svg) {
        const id = el.getAttribute("data-node-id");

        if (id) {
          nodeId = id;
          break;
        }

        el = el.parentElement;
      }

      if (!nodeId) {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ kind: "canvas", x: e.clientX, y: e.clientY });

        return;
      }

      const node = nodesByIdRef.current.get(nodeId);

      if (!node) return;

      if (node.type === "deck-lead") {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ kind: "deck-lead", x: e.clientX, y: e.clientY });

        return;
      }

      if (node.type === "orchestration") {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
          kind: "orchestration",
          x: e.clientX,
          y: e.clientY,
          coordinationId: node.coordinationId,
        });

        return;
      }

      if (node.type === "inactive-session" && node.sessionId) {
        e.preventDefault();
        e.stopPropagation();
        onNavigateRef.current?.(node.sessionId);

        return;
      }

      if (node.type === "active-session" && node.sessionId) {
        e.preventDefault();
        e.stopPropagation();

        const menu: ContextMenuState = {
          kind: "active-session",
          x: e.clientX,
          y: e.clientY,
          nodeId: node.id,
          coordinationId: node.coordinationId,
          sessionId: node.sessionId,
          label: node.label,
        };

        if (node.workspaceMode) menu.workspaceMode = node.workspaceMode;

        setContextMenu(menu);
      }
    };

    svg.addEventListener("contextmenu", handler);

    return () => svg.removeEventListener("contextmenu", handler);
  }, [svgRef]);

  const handleCreateAgent = useCallback(
    (coordinationId: string) => {
      if (!onCreateAgent) return;
      setContextMenu(null);
      const result = onCreateAgent(coordinationId);

      if (result && isFunctionValue(result.then)) {
        void result.then((agentId) => {
          if (agentId) setPendingOpenAgentId(agentId);
        });
      }
    },
    [onCreateAgent],
  );

  const handleSpawnSwarm = useCallback(
    async (coordinationId: string, workspaceMode: TerminalWorkspaceMode) => {
      setContextMenu(null);
      await onSpawnSwarm?.(coordinationId, workspaceMode);
      refreshGraphData();
    },
    [onSpawnSwarm, refreshGraphData],
  );

  const handleDeckLeadAction = useCallback(
    (action: string) => {
      setContextMenu(null);
      const result = onDeckLeadAction?.(action);

      if (result && isFunctionValue(result.then)) {
        void result.then((agentId) => {
          if (agentId) setPendingOpenAgentId(agentId);
        });
      }
    },
    [onDeckLeadAction],
  );

  const handleOrchestrationAction = useCallback(
    (coordinationId: string, action: string) => {
      setContextMenu(null);
      const result = onOrchestrationAction?.(coordinationId, action);

      if (result && isFunctionValue(result.then)) {
        void result.then((agentId) => {
          if (agentId) setPendingOpenAgentId(agentId);
        });
      }
    },
    [onOrchestrationAction],
  );

  if (pendingOpenAgentId) {
    const nodeId = buildActiveSessionNodeId(pendingOpenAgentId);
    const node = resolveActiveSessionNode(pendingOpenAgentId);

    if (node) {
      setPendingOpenAgentId(null);
      setSelectedNodeId(nodeId);
      setOpenTerminals((prev) => {
        const next = new Map(prev);
        next.set(nodeId, { ...node });

        return next;
      });
    }
  }

  if (isUiStateHydrated && recentlyCreatedTerminal) {
    const terminalId = recentlyCreatedTerminal.terminalId;

    if (lastHandledCreatedTerminalId !== terminalId) {
      if (
        !recentlyCreatedTerminal.parentTerminalId ||
        !openTerminals.has(buildActiveSessionNodeId(recentlyCreatedTerminal.parentTerminalId))
      ) {
        setLastHandledCreatedTerminalId(terminalId);
      } else {
        const nodeId = buildActiveSessionNodeId(terminalId);
        const node = resolveActiveSessionNode(terminalId);

        if (node) {
          setLastHandledCreatedTerminalId(terminalId);
          setSelectedNodeId(nodeId);
          setOpenTerminals((prev) => {
            const next = new Map(prev);
            next.set(nodeId, { ...node });

            return next;
          });
        }
      }
    }
  }

  useEffect(() => {
    if (!selectedNodeId) {
      lastFocusedPanelIdRef.current = null;

      return;
    }

    if (!openTerminals.has(selectedNodeId) && !openOrchestrations.has(selectedNodeId)) {
      if (lastFocusedPanelIdRef.current === selectedNodeId) {
        lastFocusedPanelIdRef.current = null;
      }

      return;
    }

    if (lastFocusedPanelIdRef.current === selectedNodeId) {
      return;
    }

    const panel = panelRefs.current.get(selectedNodeId);

    if (!panel) {
      return;
    }

    lastFocusedPanelIdRef.current = selectedNodeId;

    const rafId = window.requestAnimationFrame(() => {
      panel.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
      panel.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [selectedNodeId, openTerminals, openOrchestrations]);

  const orchestrationNodes = simulatedNodes.filter(
    (n) => n.type === "orchestration" || n.type === "deck-lead",
  );

  const sessionNodes = simulatedNodes.filter((n) => {
    if (n.type === "orchestration" || n.type === "deck-lead") return false;

    if (hideIdleTerminals && n.type === "inactive-session") return false;

    if (
      hideIdleTerminals &&
      n.type === "active-session" &&
      (n.agentState === "idle" || n.hasUserPrompt === false)
    )
      return false;

    return true;
  });

  const handleFitView = useCallback(() => {
    fitAll(simulatedNodes);
  }, [fitAll, simulatedNodes]);

  const handleRefresh = useCallback(() => {
    if (onRefreshColumns) {
      const result = onRefreshColumns();

      if (result && isFunctionValue(result.then)) {
        void result.finally(() => {
          refreshGraphData();
        });

        return;
      }
    }

    refreshGraphData();
  }, [onRefreshColumns, refreshGraphData]);

  const waitingNodes = simulatedNodes.filter(
    (n) =>
      n.type === "active-session" &&
      (n.agentRuntimeState === "waiting_for_permission" ||
        n.agentRuntimeState === "waiting_for_user"),
  );

  const sessionEdges = edges
    .map((edge) => {
      const source = nodesById.get(edge.source);
      const target = nodesById.get(edge.target);

      if (!source || !target) {
        return null;
      }

      if (source.type !== "active-session" || target.type !== "active-session") {
        return null;
      }

      if (
        hideIdleTerminals &&
        (source.agentState === "idle" ||
          source.hasUserPrompt === false ||
          target.agentState === "idle" ||
          target.hasUserPrompt === false)
      ) {
        return null;
      }

      return { source, target };
    })
    .filter((edge): edge is { source: GraphNode; target: GraphNode } => edge !== null);

  const sessionEdgesBySource = new Map<string, { source: GraphNode; target: GraphNode }[]>();

  for (const edge of sessionEdges) {
    const group = sessionEdgesBySource.get(edge.source.id);

    if (group) {
      group.push(edge);
    } else {
      sessionEdgesBySource.set(edge.source.id, [edge]);
    }
  }

  for (const group of sessionEdgesBySource.values()) {
    group.sort((left, right) => {
      const leftAngle = Math.atan2(left.target.y - left.source.y, left.target.x - left.source.x);

      const rightAngle = Math.atan2(
        right.target.y - right.source.y,
        right.target.x - right.source.x,
      );

      return leftAngle - rightAngle;
    });
  }

  const hasPanels = isHydratingTerminals || openTerminals.size > 0 || openOrchestrations.size > 0;

  const terminalLayoutVersion = useMemo(() => {
    const openIds = Array.from(openTerminals.keys()).join("|");

    return `${openIds}::${terminalsPanelWidth ?? "auto"}`;
  }, [openTerminals, terminalsPanelWidth]);

  const handleLaunchWorkspaceSetupPlanner = useCallback(async () => {
    if (!onLaunchWorkspaceSetupPlanner) {
      return;
    }

    setIsLaunchingWorkspaceSetupPlanner(true);

    try {
      const agentId = await onLaunchWorkspaceSetupPlanner();

      if (agentId) {
        setPendingOpenAgentId(agentId);
      }
    } finally {
      setIsLaunchingWorkspaceSetupPlanner(false);
    }
  }, [onLaunchWorkspaceSetupPlanner]);

  const selectedNode = selectedNodeId ? (nodesById.get(selectedNodeId) ?? null) : null;

  const selectedTerminalId = selectedNode
    ? selectedNode.id.startsWith("t:")
      ? selectedNode.id.slice(2)
      : selectedNode.id
    : null;

  const selectedTerminal =
    selectedTerminalId != null
      ? (columns.find((column) => column.terminalId === selectedTerminalId) ?? null)
      : null;

  return (
    <section
      ref={containerRef}
      className="canvas-view canvas-view--chrome"
      aria-label="Canvas graph view"
    >
      <ConsoleChromeToolbar
        hideIdle={hideIdleTerminals}
        onToggleHideIdle={() => setHideIdleTerminals((prev) => !prev)}
        onCreateTerminal={() => {
          const result = onCreateTerminal?.();

          if (result && isFunctionValue(result.then)) {
            void result.then((agentId) => {
              if (agentId) setPendingOpenAgentId(agentId);
            });
          }
        }}
        onFitView={handleFitView}
        onRefresh={handleRefresh}
        onDeleteAll={() => setIsDeleteAllDialogOpen(true)}
        onNewAgent={() => {
          const result = onCreateTerminal?.();

          if (result && isFunctionValue(result.then)) {
            void result.then((agentId) => {
              if (agentId) setPendingOpenAgentId(agentId);
            });
          }
        }}
        showSetup={shouldShowWorkspaceSetupCard && visibleWorkspaceSetupOverlay === "hidden"}
        onShowSetup={() => setWorkspaceSetupOverlay("expanded")}
      />

      <div className="canvas-workspace-row">
        <div
          className={`canvas-graph-panel design-canvas-panel${hasPanels ? " canvas-graph-panel--split" : ""}${showCanvasGrid ? " design-canvas-panel--grid" : ""}`}
        >
          <svg
            aria-label="Canvas graph"
            role="grid"
            tabIndex={0}
            ref={svgRef}
            className={`canvas-svg${isPanning || dragNodeId ? " canvas-svg--panning" : ""}`}
            onWheel={handleWheel}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleSvgPointerMove}
            onPointerUp={handleSvgPointerUp}
            onClick={handleSvgClick}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setContextMenu(null);
                setSelectedNodeId(null);

                return;
              }

              if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
                e.preventDefault();
                setSelectedNodeId(null);
              }
            }}
          >
            <title>Canvas graph</title>
            <g
              transform={`translate(${transform.translateX}, ${transform.translateY}) scale(${transform.scale})`}
            >
              {Array.from(sessionEdgesBySource.entries()).flatMap(([sourceId, group]) =>
                group.map(({ source, target }, index) => {
                  const active = selectedNodeId === source.id || selectedNodeId === target.id;

                  const selectedColor = selectedNodeId
                    ? (nodesById.get(selectedNodeId)?.color ?? null)
                    : null;

                  const path = buildCanvasEdgePath(source, target, index, group.length);

                  return (
                    <g key={`${sourceId}->${target.id}`}>
                      <path
                        className="canvas-edge"
                        d={path}
                        fill="none"
                        stroke={active ? (selectedColor ?? source.color) : "#C0C0C0"}
                        strokeWidth={active ? 2 : 1.5}
                        strokeOpacity={1}
                      />
                      <path
                        className="canvas-edge-flow"
                        d={path}
                        fill="none"
                        stroke={active ? (selectedColor ?? source.color) : "#C0C0C0"}
                        strokeWidth={active ? 2 : 1.5}
                        strokeOpacity={active ? 0.85 : 0.4}
                      />
                      {isEdgeActivityVisible(target)
                        ? renderEdgeActivityDots(
                            path,
                            active ? (selectedColor ?? source.color) : source.color,
                            `${sourceId}->${target.id}`,
                          )
                        : null}
                    </g>
                  );
                }),
              )}

              {orchestrationNodes.map((node) => {
                const connected = edges
                  .filter((e) => e.source === node.id)
                  .map((e) => nodesById.get(e.target))
                  .filter((n): n is GraphNode => {
                    if (!n) return false;

                    if (hideIdleTerminals && n.type === "inactive-session") return false;

                    if (
                      hideIdleTerminals &&
                      n.type === "active-session" &&
                      (n.agentState === "idle" || n.hasUserPrompt === false)
                    )
                      return false;

                    return true;
                  });

                const selectedColor = selectedNodeId
                  ? (nodesById.get(selectedNodeId)?.color ?? null)
                  : null;

                return (
                  <MascotNode
                    key={node.id}
                    node={node}
                    connectedNodes={connected}
                    isSelected={selectedNodeId === node.id}
                    selectedNodeId={selectedNodeId}
                    selectedNodeColor={selectedColor}
                    onPointerDown={handleNodePointerDown}
                    onClick={handleNodeClick}
                  />
                );
              })}

              {sessionNodes.map((node) => (
                <SessionNode
                  key={node.id}
                  node={node}
                  isSelected={selectedNodeId === node.id}
                  onPointerDown={handleNodePointerDown}
                  onClick={handleNodeClick}
                />
              ))}
            </g>
          </svg>

          <div className="pointer-events-none absolute right-4 top-4 rounded-lg border border-border bg-surface p-3 shadow-sm">
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
              Legend
            </p>
            <div className="space-y-1.5">
              {[
                ["running", "Running"],
                ["stopped", "Stopped"],
                ["stale", "Stale"],
                ["idle", "Idle"],
              ].map(([status, label]) => (
                <div key={status} className="flex items-center gap-2">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: `var(--${status})` }}
                  />
                  <span className="text-[14px] text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {waitingNodes.length > 0 && (
            <div className="canvas-waiting-list">
              {waitingNodes.map((node) => {
                const nameRaw = node.label;
                const name = nameRaw.length > 20 ? `${nameRaw.slice(0, 20)}…` : nameRaw;

                const prefix =
                  node.agentRuntimeState === "waiting_for_permission"
                    ? `${node.waitingToolName ?? "Permission"}: `
                    : "Waiting: ";

                return (
                  <button
                    key={node.id}
                    type="button"
                    className="canvas-waiting-bar"
                    onClick={() => handleNodeClick(node.id)}
                  >
                    <span className="canvas-waiting-bar-name">
                      <span className="canvas-waiting-bar-prefix">{prefix}</span>
                      {name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {shouldShowWorkspaceSetupCard && visibleWorkspaceSetupOverlay === "expanded" ? (
            <div className="canvas-setup-overlay">
              <WorkspaceSetupCard
                workspaceSetup={workspaceSetup}
                isLoading={isWorkspaceSetupLoading}
                error={workspaceSetupError}
                onRunStep={(stepId) => {
                  void onRunWorkspaceSetupStep?.(stepId);
                }}
                onLaunchAgent={() => {
                  void handleLaunchWorkspaceSetupPlanner();
                }}
                isLaunchingAgent={isLaunchingWorkspaceSetupPlanner}
                isRunningStepId={runningWorkspaceSetupStepId}
                onMinimize={() => setWorkspaceSetupOverlay("minimized")}
                onDismiss={() => setWorkspaceSetupOverlay("hidden")}
              />
            </div>
          ) : null}
          {shouldShowWorkspaceSetupCard && visibleWorkspaceSetupOverlay === "minimized" ? (
            <div className="canvas-setup-overlay canvas-setup-overlay--minimized">
              <button
                type="button"
                className="workspace-setup-minimized-bar"
                aria-label={
                  incompleteWorkspaceSetupSteps > 0
                    ? `Expand workspace setup, ${incompleteWorkspaceSetupSteps} steps incomplete`
                    : "Expand workspace setup"
                }
                onClick={() => setWorkspaceSetupOverlay("expanded")}
              >
                <ListTodo size={16} strokeWidth={2} aria-hidden />
                <span className="workspace-setup-minimized-bar-label">
                  Workspace setup
                  {incompleteWorkspaceSetupSteps > 0
                    ? ` · ${incompleteWorkspaceSetupSteps} incomplete`
                    : ""}
                </span>
                <ChevronUp size={16} strokeWidth={2} aria-hidden />
              </button>
            </div>
          ) : null}

          <div className="absolute left-3 top-3 z-10 w-72 max-w-[40%] overflow-hidden rounded-xl border border-border bg-surface/90 backdrop-blur empty:hidden">
            <ThreadTree onApproval={answerApproval} onOpen={openTerminalFor} terminals={columns} />
          </div>

          <ConsoleCanvasViewportControls
            scale={transform.scale}
            showGrid={showCanvasGrid}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onFitView={handleFitView}
            onToggleGrid={() => setShowCanvasGrid((prev) => !prev)}
          />
        </div>

        {hasPanels && (
          <>
            <hr
              className="canvas-panel-divider h-auto border-t-0"
              aria-label="Resize terminal panels"
              aria-orientation="vertical"
              onPointerDown={handleDividerPointerDown}
              onPointerMove={handleDividerPointerMove}
              onPointerUp={handleDividerPointerUp}
            />
            <div
              ref={terminalsPanelRef}
              className="canvas-terminals-panel"
              style={
                terminalsPanelWidth != null ? { flex: `0 0 ${terminalsPanelWidth}px` } : undefined
              }
            >
              {Array.from(openOrchestrations.entries()).map(([nodeId, node]) => (
                <CanvasOrchestrationPanel
                  key={nodeId}
                  node={node}
                  isFocused={selectedNodeId === nodeId}
                  panelRef={setPanelRef(nodeId)}
                  orchestration={orchestrationById.get(node.coordinationId) ?? null}
                  sessions={sessionsByOrchestrationId.get(node.coordinationId) ?? []}
                  onClose={() => handleCloseOrchestration(nodeId)}
                  onFocus={() => handlePanelFocus(nodeId)}
                  onCreateAgent={(coordinationId) => {
                    handleCreateAgent(coordinationId);
                  }}
                  onSolveTodoItem={(coordinationId, itemIndex) => {
                    void onSolveTodoItem?.(coordinationId, itemIndex);
                  }}
                  onSpawnSwarm={(coordinationId, workspaceMode) => {
                    return handleSpawnSwarm(coordinationId, workspaceMode);
                  }}
                  onNavigateToConversation={onNavigateToConversation}
                  onRefreshOrchestrationData={refreshDeckOrchestrations}
                />
              ))}
              {isHydratingTerminals && openTerminals.size === 0 && (
                <div className="canvas-terminal-skeleton">
                  <div className="canvas-terminal-skeleton__header" />
                  <div className="canvas-terminal-skeleton__body">
                    <div className="canvas-terminal-skeleton__line" style={{ width: "60%" }} />
                    <div className="canvas-terminal-skeleton__line" style={{ width: "80%" }} />
                    <div className="canvas-terminal-skeleton__line" style={{ width: "45%" }} />
                  </div>
                </div>
              )}
              {Array.from(openTerminals.entries()).map(([nodeId, node]) => (
                <CanvasTerminalColumn
                  key={nodeId}
                  node={node}
                  terminals={columns}
                  layoutVersion={terminalLayoutVersion}
                  isFocused={selectedNodeId === nodeId}
                  panelRef={setPanelRef(nodeId)}
                  onMinimize={() => handleMinimizeTerminal(nodeId)}
                  onClose={() => handleCloseTerminal(node)}
                  onFocus={() => handlePanelFocus(nodeId)}
                  onTerminalRenamed={onTerminalRenamed}
                  onTerminalActivity={onTerminalActivity}
                />
              ))}
            </div>
          </>
        )}

        <ConsoleInspectorPanel
          selectedNode={selectedNode}
          terminal={selectedTerminal}
          gitStatus={
            selectedNode ? (gitStatusByOrchestrationId[selectedNode.coordinationId] ?? null) : null
          }
        />
      </div>

      {contextMenu && (
        <CanvasContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          onCreateAgent={handleCreateAgent}
          onCreateOrchestration={onCreateOrchestration}
          onCreateTerminal={onCreateTerminal}
          onCreateWorktreeTerminal={onCreateWorktreeTerminal}
          onDeckLeadAction={handleDeckLeadAction}
          onDeleteActiveSession={onDeleteActiveSession}
          onOpenAgent={setPendingOpenAgentId}
          onOrchestrationAction={handleOrchestrationAction}
          onSpawnSwarm={handleSpawnSwarm}
        />
      )}

      {pendingDeleteTerminal && onCancelDelete && onConfirmDelete && (
        <div className="canvas-delete-dialog">
          <DeleteOrchestrationDialog
            pendingDeleteTerminal={pendingDeleteTerminal}
            isDeletingTerminalId={isDeletingTerminalId ?? null}
            onCancel={onCancelDelete}
            onConfirmDelete={onConfirmDelete}
          />
        </div>
      )}

      {isDeleteAllDialogOpen && (
        <div className="canvas-delete-dialog">
          <DeleteAllTerminalsDialog
            columns={columns}
            nodes={nodes}
            onCancel={() => setIsDeleteAllDialogOpen(false)}
            onDeleted={({ hadFailures }) => {
              if (!hadFailures) {
                setIsDeleteAllDialogOpen(false);
              }

              setOpenTerminals(new Map());
              void onRefreshColumns?.();
              refreshGraphData();
            }}
          />
        </div>
      )}
    </section>
  );
};
