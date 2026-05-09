import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { WorkspaceSetupSnapshot, WorkspaceSetupStepId } from "@adadex/core";
import {
  Check as CheckIcon,
  ChevronDown,
  GitBranch,
  Hexagon,
  Layers,
  ListTodo,
  Maximize,
  Pause,
  Play,
  RefreshCw,
  Sparkles,
  Terminal as TerminalIcon,
  Trash2,
  X,
} from "lucide-react";
import type { GraphNode } from "../app/canvas/types";
import { useAgentRuntimeStates } from "../app/hooks/useAgentRuntimeStates";
import { useCanvasGraphData } from "../app/hooks/useCanvasGraphData";
import { useCanvasTransform } from "../app/hooks/useCanvasTransform";
import { DEFAULT_FORCE_PARAMS, useForceSimulation } from "../app/hooks/useForceSimulation";
import type { PendingDeleteTerminal } from "../app/hooks/useTerminalMutations";
import {
  type TerminalRuntimeStateStore,
  createTerminalRuntimeStateStore,
} from "../app/terminalRuntimeStateStore";
import type { TerminalView, TerminalWorkspaceMode } from "../app/types";
import { DeleteTentacleDialog } from "./DeleteTentacleDialog";
import { CanvasTentaclePanel } from "./canvas/CanvasTentaclePanel";
import { CanvasTerminalColumn } from "./canvas/CanvasTerminalColumn";
import { DeleteAllTerminalsDialog } from "./canvas/DeleteAllTerminalsDialog";
import { OctopusNode } from "./canvas/OctopusNode";
import { SessionNode } from "./canvas/SessionNode";
import { WorkspaceSetupCard } from "./deck/WorkspaceSetupCard";

type ContextMenuState =
  | { kind: "canvas"; x: number; y: number }
  | { kind: "tentacle"; x: number; y: number; coordinationId: string }
  | { kind: "octoboss"; x: number; y: number }
  | {
      kind: "active-session";
      x: number;
      y: number;
      nodeId: string;
      coordinationId: string;
      sessionId: string;
      label: string;
      workspaceMode?: string;
    };

type CanvasPrimaryViewProps = {
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
  onCanvasOpenTentacleIdsChange?: (ids: string[]) => void;
  onCanvasTerminalsPanelWidthChange?: (width: number | null) => void;
  onCreateAgent?: (coordinationId: string) => Promise<string | undefined> | undefined;
  onCreateTerminal?: () => Promise<string | undefined> | undefined;
  onCreateWorktreeTerminal?: () => Promise<string | undefined> | undefined;
  onCreateTentacle?: () => void;
  onSpawnSwarm?: (coordinationId: string, workspaceMode: TerminalWorkspaceMode) => Promise<void>;
  onSolveTodoItem?: (coordinationId: string, itemIndex: number) => Promise<void> | void;
  onOctobossAction?: (action: string) => Promise<string | undefined> | undefined;
  onTentacleAction?: (
    coordinationId: string,
    action: string,
  ) => Promise<string | undefined> | undefined;
  onNavigateToConversation?: (sessionId: string) => void;
  onCloseActiveSession?: (terminalId: string, terminalName: string, workspaceMode?: string) => void;
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
};

const CLICK_THRESHOLD = 5;
const GRAPH_MIN_WIDTH = 300;
const TERMINAL_MIN_WIDTH = 370;
const ACTIVE_SESSION_RADIUS = 12;
const buildActiveSessionNodeId = (terminalId: string) => `a:${terminalId}`;
const buildTentacleNodeId = (coordinationId: string) => `t:${coordinationId}`;

const buildCanvasEdgePath = (
  source: GraphNode,
  target: GraphNode,
  edgeIndex: number,
  edgeCount: number,
): string => {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return "";

  const shortenSourceBy = source.radius + 6;
  const shortenTargetBy = target.radius + 6;
  const startRatio = Math.min(1, shortenSourceBy / dist);
  const endRatio = Math.max(0, (dist - shortenTargetBy) / dist);
  const sx = source.x + dx * startRatio;
  const sy = source.y + dy * startRatio;
  const tx = source.x + dx * endRatio;
  const ty = source.y + dy * endRatio;

  const curvature = edgeCount <= 1 ? 0.18 : (edgeIndex / (edgeCount - 1) - 0.5) * 1.2;
  const offsetRatio = edgeCount <= 1 ? 0.16 : 0.18;
  const baseOffset = Math.max(16, Math.min(32, dist * offsetRatio));
  const offsetX = (-dy / dist) * curvature * baseOffset;
  const offsetY = (dx / dist) * curvature * baseOffset;
  const cpx = (sx + tx) / 2 + offsetX;
  const cpy = (sy + ty) / 2 + offsetY;

  return `M ${sx} ${sy} Q ${cpx} ${cpy} ${tx} ${ty}`;
};

const isEdgeActivityVisible = (target: GraphNode): boolean =>
  target.type === "active-session" &&
  target.hasUserPrompt !== false &&
  target.agentRuntimeState !== undefined &&
  target.agentRuntimeState !== "idle";

const renderEdgeActivityDots = (path: string, color: string, keyPrefix: string) =>
  [0, 1, 2].flatMap((index) => [
    <circle
      key={`${keyPrefix}-trail-${index}`}
      className="canvas-edge-activity-dot canvas-edge-activity-dot--trail"
      r={4.6}
      fill={color}
      opacity={Math.max(0.14, 0.28 - index * 0.04)}
    >
      <animateMotion
        path={path}
        begin={`${index * 0.62}s`}
        dur="1.9s"
        repeatCount="indefinite"
        rotate="auto"
      />
      <animate
        attributeName="r"
        values="3.8;5.2;3.8"
        dur="1.9s"
        begin={`${index * 0.62}s`}
        repeatCount="indefinite"
      />
    </circle>,
    <circle
      key={`${keyPrefix}-dot-${index}`}
      className="canvas-edge-activity-dot"
      r={3.2}
      fill="#fff4cc"
      stroke={color}
      strokeWidth={1.2}
      opacity={Math.max(0.7, 1 - index * 0.08)}
    >
      <animateMotion
        path={path}
        begin={`${index * 0.62}s`}
        dur="1.9s"
        repeatCount="indefinite"
        rotate="auto"
      />
      <animate
        attributeName="r"
        values="2.8;3.8;2.8"
        dur="1.9s"
        begin={`${index * 0.62}s`}
        repeatCount="indefinite"
      />
    </circle>,
  ]);

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
  onCanvasOpenTentacleIdsChange,
  onCanvasTerminalsPanelWidthChange,
  onCreateAgent,
  onCreateTerminal,
  onCreateWorktreeTerminal,
  onCreateTentacle,
  onSpawnSwarm,
  onSolveTodoItem,
  onOctobossAction,
  onTentacleAction,
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
}: CanvasPrimaryViewProps) => {
  const runtimeStateStoreRef = useRef<TerminalRuntimeStateStore | null>(null);
  if (runtimeStateStoreRef.current === null) {
    runtimeStateStoreRef.current = providedRuntimeStateStore ?? createTerminalRuntimeStateStore();
  }
  const runtimeStateStore = providedRuntimeStateStore ?? runtimeStateStoreRef.current;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);
  const [openTerminals, setOpenTerminals] = useState<Map<string, GraphNode>>(new Map());
  const [openTentacles, setOpenTentacles] = useState<Map<string, GraphNode>>(new Map());
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [terminalsPanelWidth, setTerminalsPanelWidth] = useState<number | null>(null);
  const [pendingOpenAgentId, setPendingOpenAgentId] = useState<string | null>(null);
  const [hideIdleTerminals, setHideIdleTerminals] = useState(false);
  const [isLaunchingWorkspaceSetupPlanner, setIsLaunchingWorkspaceSetupPlanner] = useState(false);
  const hasHydratedTerminals = useRef(false);
  const hasHydratedTentacles = useRef(false);
  const lastHandledCreatedTerminalIdRef = useRef<string | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const nodeClickedRef = useRef(false);
  const dividerDragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const containerRef = useRef<HTMLElement>(null);
  const terminalsPanelRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef(new Map<string, HTMLElement>());
  const lastFocusedPanelIdRef = useRef<string | null>(null);
  const shouldShowWorkspaceSetupCard = Boolean(workspaceSetup?.shouldShowSetupCard);

  const agentRuntimeStates = useAgentRuntimeStates(runtimeStateStore, columns);

  const {
    nodes,
    edges,
    tentacleById,
    sessionsByTentacleId,
    refresh: refreshGraphData,
    refreshDeckTentacles,
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
  } = useCanvasTransform();

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
        : buildTentacleNodeId(terminal.coordinationId);
      const anchorNode =
        existingNode?.type === "active-session"
          ? existingNode
          : (nodesById.get(parentNodeId) ??
            nodesById.get(buildTentacleNodeId(terminal.coordinationId)));

      return {
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
        ...(terminal.workspaceMode ? { workspaceMode: terminal.workspaceMode } : {}),
        ...(terminal.parentTerminalId ? { parentTerminalId: terminal.parentTerminalId } : {}),
      };
    },
    [columns, nodesById],
  );

  // Hydrate open terminals after a settling delay so all async data (columns,
  // graph nodes, simulation) has time to land before we attempt the lookup.
  const [isHydratingTerminals, setIsHydratingTerminals] = useState(false);

  useEffect(() => {
    if (hasHydratedTerminals.current) return;
    if (!isUiStateHydrated) return;
    if (!canvasOpenTerminalIds || canvasOpenTerminalIds.length === 0) {
      hasHydratedTerminals.current = true;
      return;
    }

    setIsHydratingTerminals(true);
    const timer = window.setTimeout(() => {
      setIsHydratingTerminals(false);
      hasHydratedTerminals.current = true;
    }, 800);

    return () => window.clearTimeout(timer);
  }, [isUiStateHydrated, canvasOpenTerminalIds]);

  // Once the settling timer fires, perform the actual hydration from the
  // simulation graph which should now be fully populated.
  const openTerminalCount = openTerminals.size;
  useEffect(() => {
    if (isHydratingTerminals) return;
    if (!hasHydratedTerminals.current) return;
    if (openTerminalCount > 0) return;
    if (!canvasOpenTerminalIds || canvasOpenTerminalIds.length === 0) return;

    const restoredMap = new Map<string, GraphNode>();
    for (const nodeId of canvasOpenTerminalIds) {
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
  }, [
    isHydratingTerminals,
    openTerminalCount,
    canvasOpenTerminalIds,
    persistedTerminalsPanelWidth,
    nodesById,
  ]);

  // Persist open terminal IDs when they change
  useEffect(() => {
    if (!hasHydratedTerminals.current) return;
    onCanvasOpenTerminalIdsChange?.(Array.from(openTerminals.keys()));
  }, [openTerminals, onCanvasOpenTerminalIdsChange]);

  useEffect(() => {
    setOpenTerminals((current) => {
      let didChange = false;
      const next = new Map<string, GraphNode>();

      for (const [nodeId, node] of current) {
        if (!node.sessionId) {
          next.set(nodeId, node);
          continue;
        }

        const terminal = columns.find((entry) => entry.terminalId === node.sessionId);
        if (!terminal) {
          didChange = true;
          continue;
        }

        const nextLabel = terminal.coordinationName || terminal.label || terminal.terminalId;
        const nextNode: GraphNode = {
          ...node,
          coordinationId: terminal.coordinationId,
          label: nextLabel,
          agentState: terminal.state,
          hasUserPrompt: terminal.hasUserPrompt ?? false,
          ...(terminal.workspaceMode ? { workspaceMode: terminal.workspaceMode } : {}),
          ...(terminal.parentTerminalId ? { parentTerminalId: terminal.parentTerminalId } : {}),
        };

        if (
          node.label !== nextNode.label ||
          node.coordinationId !== nextNode.coordinationId ||
          node.agentState !== nextNode.agentState ||
          node.hasUserPrompt !== nextNode.hasUserPrompt ||
          node.workspaceMode !== nextNode.workspaceMode ||
          node.parentTerminalId !== nextNode.parentTerminalId
        ) {
          didChange = true;
          next.set(nodeId, nextNode);
          continue;
        }

        next.set(nodeId, node);
      }

      return didChange ? next : current;
    });
  }, [columns]);

  // Hydrate open tentacles from persisted IDs.
  // Gate on tentacle-type nodes being present (deck API fetch is async).
  const hasTentacleNodes = simulatedNodes.some((n) => n.type === "tentacle");
  const openTentacleCount = openTentacles.size;
  useEffect(() => {
    if (hasHydratedTentacles.current) return;
    if (!isUiStateHydrated) return;
    if (!hasTentacleNodes) return;

    if (canvasOpenCoordinationIds && canvasOpenCoordinationIds.length > 0) {
      const restoredMap = new Map<string, GraphNode>();
      for (const nodeId of canvasOpenCoordinationIds) {
        const node = nodesById.get(nodeId);
        if (node && (node.type === "tentacle" || node.type === "octoboss")) {
          restoredMap.set(nodeId, { ...node });
        }
      }
      if (restoredMap.size > 0) {
        setOpenTentacles(restoredMap);
      }
    }

    hasHydratedTentacles.current = true;
  }, [isUiStateHydrated, canvasOpenCoordinationIds, hasTentacleNodes, nodesById]);

  // Persist open tentacle IDs when they change
  useEffect(() => {
    if (!hasHydratedTentacles.current) return;
    onCanvasOpenTentacleIdsChange?.(Array.from(openTentacles.keys()));
  }, [openTentacles, onCanvasOpenTentacleIdsChange]);

  // Persist terminals panel width only when user has explicitly dragged the divider
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
      } else if (node.type === "tentacle" || node.type === "octoboss") {
        setOpenTentacles((prev) => {
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

  const handleCloseTentacle = useCallback((nodeId: string) => {
    setOpenTentacles((prev) => {
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

      const terminal = columns.find((entry) => entry.terminalId === node.sessionId);
      onCloseActiveSession?.(
        node.sessionId,
        terminal?.coordinationName ?? node.label,
        terminal?.workspaceMode ?? node.workspaceMode,
      );
    },
    [columns, onCloseActiveSession],
  );

  // Divider drag handlers
  const handleDividerPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      // Measure the actual rendered width of the terminals panel (works whether CSS- or inline-sized)
      const panelEl = (e.target as HTMLElement).nextElementSibling as HTMLElement | null;
      const currentWidth = panelEl?.clientWidth ?? terminalsPanelWidth ?? 600;
      dividerDragRef.current = { startX: e.clientX, startWidth: currentWidth };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [terminalsPanelWidth],
  );

  const handleDividerPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dividerDragRef.current;
    if (!drag) return;
    const containerWidth = containerRef.current?.clientWidth ?? 1200;
    // Dragging left → terminals grow, dragging right → terminals shrink
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

  // Convert vertical wheel to horizontal scroll only when hovering terminal headers
  useEffect(() => {
    if (!isHydratingTerminals && openTerminalCount === 0 && openTentacleCount === 0) return;
    const panel = terminalsPanelRef.current;
    if (!panel) return;
    const handler = (e: WheelEvent) => {
      const target = e.target as Element | null;
      if (!target?.closest(".canvas-terminal-column-header")) return;
      if (e.deltaY !== 0 && e.deltaX === 0) {
        e.preventDefault();
        panel.scrollLeft += e.deltaY;
      }
    };
    panel.addEventListener("wheel", handler, { passive: false });
    return () => panel.removeEventListener("wheel", handler);
  }, [isHydratingTerminals, openTerminalCount, openTentacleCount]);

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

  // Stable ref for nodesById so native listener always sees latest data
  const nodesByIdRef = useRef(nodesById);
  nodesByIdRef.current = nodesById;

  // Stable refs so the native listener always sees the latest callbacks
  const onNavigateRef = useRef(onNavigateToConversation);
  onNavigateRef.current = onNavigateToConversation;

  // Native contextmenu listener — must be native to reliably preventDefault
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handler = (e: MouseEvent) => {
      let el = e.target as Element | null;
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

      if (node.type === "octoboss") {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ kind: "octoboss", x: e.clientX, y: e.clientY });
        return;
      }

      if (node.type === "tentacle") {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
          kind: "tentacle",
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
        setContextMenu({
          kind: "active-session",
          x: e.clientX,
          y: e.clientY,
          nodeId: node.id,
          coordinationId: node.coordinationId,
          sessionId: node.sessionId,
          label: node.label,
          ...(node.workspaceMode ? { workspaceMode: node.workspaceMode } : {}),
        });
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
      if (result && typeof result.then === "function") {
        void result.then((agentId) => {
          if (agentId) setPendingOpenAgentId(agentId);
        });
      }
    },
    [onCreateAgent],
  );

  const handleSpawnSwarm = useCallback(
    (coordinationId: string, workspaceMode: TerminalWorkspaceMode) => {
      setContextMenu(null);
      void onSpawnSwarm?.(coordinationId, workspaceMode);
    },
    [onSpawnSwarm],
  );

  const handleOctobossAction = useCallback(
    (action: string) => {
      setContextMenu(null);
      const result = onOctobossAction?.(action);
      if (result && typeof result.then === "function") {
        void result.then((agentId) => {
          if (agentId) setPendingOpenAgentId(agentId);
        });
      }
    },
    [onOctobossAction],
  );

  const handleTentacleAction = useCallback(
    (coordinationId: string, action: string) => {
      setContextMenu(null);
      const result = onTentacleAction?.(coordinationId, action);
      if (result && typeof result.then === "function") {
        void result.then((agentId) => {
          if (agentId) setPendingOpenAgentId(agentId);
        });
      }
    },
    [onTentacleAction],
  );

  // Auto-open terminal for newly created agent once it appears in the graph
  useEffect(() => {
    if (!pendingOpenAgentId) return;
    const nodeId = buildActiveSessionNodeId(pendingOpenAgentId);
    const node = resolveActiveSessionNode(pendingOpenAgentId);
    if (!node) return;
    setPendingOpenAgentId(null);
    setSelectedNodeId(nodeId);
    setOpenTerminals((prev) => {
      const next = new Map(prev);
      next.set(nodeId, { ...node });
      return next;
    });
  }, [pendingOpenAgentId, resolveActiveSessionNode]);

  useEffect(() => {
    if (!isUiStateHydrated || !recentlyCreatedTerminal) {
      return;
    }
    if (lastHandledCreatedTerminalIdRef.current === recentlyCreatedTerminal.terminalId) {
      return;
    }
    if (!recentlyCreatedTerminal.parentTerminalId) {
      lastHandledCreatedTerminalIdRef.current = recentlyCreatedTerminal.terminalId;
      return;
    }
    if (!openTerminals.has(buildActiveSessionNodeId(recentlyCreatedTerminal.parentTerminalId))) {
      lastHandledCreatedTerminalIdRef.current = recentlyCreatedTerminal.terminalId;
      return;
    }

    const nodeId = buildActiveSessionNodeId(recentlyCreatedTerminal.terminalId);
    const node = resolveActiveSessionNode(recentlyCreatedTerminal.terminalId);
    if (!node) {
      return;
    }

    lastHandledCreatedTerminalIdRef.current = recentlyCreatedTerminal.terminalId;
    setSelectedNodeId(nodeId);
    setOpenTerminals((prev) => {
      const next = new Map(prev);
      next.set(nodeId, { ...node });
      return next;
    });
  }, [isUiStateHydrated, openTerminals, recentlyCreatedTerminal, resolveActiveSessionNode]);

  useEffect(() => {
    if (!selectedNodeId) {
      lastFocusedPanelIdRef.current = null;
      return;
    }
    if (!openTerminals.has(selectedNodeId) && !openTentacles.has(selectedNodeId)) {
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
  }, [selectedNodeId, openTerminals, openTentacles]);

  // Separate tentacle and session nodes for render order
  const tentacleNodes = simulatedNodes.filter(
    (n) => n.type === "tentacle" || n.type === "octoboss",
  );
  const sessionNodes = simulatedNodes.filter((n) => {
    if (n.type === "tentacle" || n.type === "octoboss") return false;
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
      if (result && typeof result.then === "function") {
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

  const hasPanels = isHydratingTerminals || openTerminals.size > 0 || openTentacles.size > 0;
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

  return (
    <section ref={containerRef} className="canvas-view" aria-label="Canvas graph view">
      <div className={`canvas-graph-panel${hasPanels ? " canvas-graph-panel--split" : ""}`}>
        <svg
          aria-label="Canvas graph"
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

            {/* Render tentacle nodes (with arms) first */}
            {tentacleNodes.map((node) => {
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
                <OctopusNode
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

            {/* Render session nodes on top */}
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

        {/* Canvas toolbar — top-left action buttons */}
        <div className="canvas-toolbar" role="toolbar" aria-label="Canvas actions">
          <button
            type="button"
            className="canvas-toolbar-btn"
            onClick={() => {
              const result = onCreateTerminal?.();
              if (result && typeof result.then === "function") {
                void result.then((agentId) => {
                  if (agentId) setPendingOpenAgentId(agentId);
                });
              }
            }}
          >
            <span className="canvas-toolbar-icon">
              <TerminalIcon size={14} />
            </span>
            <span className="canvas-toolbar-label">Terminal</span>
          </button>
          <button
            type="button"
            className="canvas-toolbar-btn"
            onClick={() => {
              const result = onCreateWorktreeTerminal?.();
              if (result && typeof result.then === "function") {
                void result.then((agentId) => {
                  if (agentId) setPendingOpenAgentId(agentId);
                });
              }
            }}
          >
            <span className="canvas-toolbar-icon">
              <GitBranch size={14} />
            </span>
            <span className="canvas-toolbar-label">Worktree</span>
          </button>
          <button type="button" className="canvas-toolbar-btn" onClick={onCreateTentacle}>
            <span className="canvas-toolbar-icon">
              <Hexagon size={14} />
            </span>
            <span className="canvas-toolbar-label">Tentacle</span>
          </button>
          <div className="canvas-toolbar-separator" />
          <button type="button" className="canvas-toolbar-btn" onClick={handleFitView}>
            <span className="canvas-toolbar-icon">
              <Maximize size={14} />
            </span>
            <span className="canvas-toolbar-label">Fit</span>
          </button>
          <button type="button" className="canvas-toolbar-btn" onClick={handleRefresh}>
            <span className="canvas-toolbar-icon">
              <RefreshCw size={14} />
            </span>
            <span className="canvas-toolbar-label">Refresh</span>
          </button>
          <div className="canvas-toolbar-separator" />
          <button
            type="button"
            className={`canvas-toolbar-btn${hideIdleTerminals ? " canvas-toolbar-btn--active" : ""}`}
            onClick={() => setHideIdleTerminals((prev) => !prev)}
          >
            <span className="canvas-toolbar-icon">
              {hideIdleTerminals ? <Play size={14} /> : <Pause size={14} />}
            </span>
            <span className="canvas-toolbar-label">
              {hideIdleTerminals ? "Show Idle" : "Hide Idle"}
            </span>
          </button>
          <div className="canvas-toolbar-separator" />
          <button
            type="button"
            className="canvas-toolbar-btn canvas-toolbar-btn--danger"
            onClick={() => setIsDeleteAllDialogOpen(true)}
          >
            <span className="canvas-toolbar-icon">
              <Trash2 size={14} />
            </span>
            <span className="canvas-toolbar-label">Delete All</span>
          </button>
        </div>

        {/* Waiting notifications — compact bars below the toolbar */}
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

        {shouldShowWorkspaceSetupCard && (
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
            />
          </div>
        )}
      </div>

      {hasPanels && (
        <>
          <div
            className="canvas-panel-divider"
            role="separator"
            aria-orientation="vertical"
            tabIndex={0}
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
            {Array.from(openTentacles.entries()).map(([nodeId, node]) => (
              <CanvasTentaclePanel
                key={nodeId}
                node={node}
                isFocused={selectedNodeId === nodeId}
                panelRef={setPanelRef(nodeId)}
                tentacle={tentacleById.get(node.coordinationId) ?? null}
                sessions={sessionsByTentacleId.get(node.coordinationId) ?? []}
                onClose={() => handleCloseTentacle(nodeId)}
                onFocus={() => setSelectedNodeId(nodeId)}
                onCreateAgent={(coordinationId) => {
                  handleCreateAgent(coordinationId);
                }}
                onSolveTodoItem={(coordinationId, itemIndex) => {
                  void onSolveTodoItem?.(coordinationId, itemIndex);
                }}
                onSpawnSwarm={(coordinationId, workspaceMode) => {
                  handleSpawnSwarm(coordinationId, workspaceMode);
                }}
                onNavigateToConversation={onNavigateToConversation}
                onRefreshTentacleData={refreshDeckTentacles}
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
                onFocus={() => setSelectedNodeId(nodeId)}
                onTerminalRenamed={onTerminalRenamed}
                onTerminalActivity={onTerminalActivity}
              />
            ))}
          </div>
        </>
      )}

      {/* Context menu */}
      {contextMenu && (
        <>
          <div
            aria-label="Close canvas context menu"
            className="canvas-context-menu-backdrop"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Close current menu, then re-derive what's under the cursor on the SVG
              setContextMenu(null);
              // Use rAF so the backdrop is removed before we probe elementFromPoint
              requestAnimationFrame(() => {
                const under = document.elementFromPoint(e.clientX, e.clientY);
                if (under) {
                  under.dispatchEvent(
                    new MouseEvent("contextmenu", {
                      bubbles: true,
                      clientX: e.clientX,
                      clientY: e.clientY,
                    }),
                  );
                }
              });
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " " && e.key !== "Escape") return;
              e.preventDefault();
              setContextMenu(null);
            }}
            role="button"
            tabIndex={0}
          />
          <div
            className="canvas-context-menu"
            style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setContextMenu(null);
              requestAnimationFrame(() => {
                const under = document.elementFromPoint(e.clientX, e.clientY);
                if (under) {
                  under.dispatchEvent(
                    new MouseEvent("contextmenu", {
                      bubbles: true,
                      clientX: e.clientX,
                      clientY: e.clientY,
                    }),
                  );
                }
              });
            }}
          >
            {contextMenu.kind === "canvas" && (
              <>
                <button
                  type="button"
                  className="canvas-context-menu-item"
                  onClick={() => {
                    setContextMenu(null);
                    onCreateTentacle?.();
                  }}
                >
                  <span className="canvas-context-menu-icon">
                    <Hexagon size={14} />
                  </span>
                  New Tentacle
                </button>
                <button
                  type="button"
                  className="canvas-context-menu-item"
                  onClick={() => {
                    setContextMenu(null);
                    const result = onCreateTerminal?.();
                    if (result && typeof result.then === "function") {
                      void result.then((agentId) => {
                        if (agentId) setPendingOpenAgentId(agentId);
                      });
                    }
                  }}
                >
                  <span className="canvas-context-menu-icon">
                    <TerminalIcon size={14} />
                  </span>
                  New Terminal
                </button>
                <button
                  type="button"
                  className="canvas-context-menu-item"
                  onClick={() => {
                    setContextMenu(null);
                    const result = onCreateWorktreeTerminal?.();
                    if (result && typeof result.then === "function") {
                      void result.then((agentId) => {
                        if (agentId) setPendingOpenAgentId(agentId);
                      });
                    }
                  }}
                >
                  <span className="canvas-context-menu-icon">
                    <GitBranch size={14} />
                  </span>
                  New Worktree Terminal
                </button>
              </>
            )}
            {contextMenu.kind === "tentacle" && (
              <>
                <button
                  type="button"
                  className="canvas-context-menu-item"
                  onClick={() => handleCreateAgent(contextMenu.coordinationId)}
                >
                  <span className="canvas-context-menu-icon">
                    <TerminalIcon size={14} />
                  </span>
                  Create new agent
                </button>
                <button
                  type="button"
                  className="canvas-context-menu-item"
                  onClick={() => {
                    setContextMenu(null);
                    const result = onCreateWorktreeTerminal?.();
                    if (result && typeof result.then === "function") {
                      void result.then((agentId) => {
                        if (agentId) setPendingOpenAgentId(agentId);
                      });
                    }
                  }}
                >
                  <span className="canvas-context-menu-icon">
                    <GitBranch size={14} />
                  </span>
                  New Worktree Terminal
                </button>
                <button
                  type="button"
                  className="canvas-context-menu-item"
                  onClick={() =>
                    handleTentacleAction(
                      contextMenu.coordinationId,
                      "coordination-reorganize-todos",
                    )
                  }
                >
                  <span className="canvas-context-menu-icon">
                    <ListTodo size={14} />
                  </span>
                  Update To-Do List
                </button>
                <button
                  type="button"
                  className="canvas-context-menu-item"
                  onClick={() =>
                    handleTentacleAction(contextMenu.coordinationId, "coordination-update")
                  }
                >
                  <span className="canvas-context-menu-icon">
                    <Hexagon size={14} />
                  </span>
                  Update Tentacle
                </button>
                <button
                  type="button"
                  className="canvas-context-menu-item"
                  onClick={() => handleSpawnSwarm(contextMenu.coordinationId, "worktree")}
                >
                  <span className="canvas-context-menu-icon">
                    <Layers size={14} />
                  </span>
                  Spawn Swarm (Worktrees)
                </button>
                <button
                  type="button"
                  className="canvas-context-menu-item"
                  onClick={() => handleSpawnSwarm(contextMenu.coordinationId, "shared")}
                >
                  <span className="canvas-context-menu-icon">
                    <Layers size={14} />
                  </span>
                  Spawn Swarm (Normal)
                </button>
              </>
            )}
            {contextMenu.kind === "octoboss" && (
              <>
                <button
                  type="button"
                  className="canvas-context-menu-item"
                  onClick={() => handleOctobossAction("octoboss-reorganize-todos")}
                >
                  <span className="canvas-context-menu-icon">
                    <ListTodo size={14} />
                  </span>
                  Reorganize To-Do's
                </button>
                <button
                  type="button"
                  className="canvas-context-menu-item"
                  onClick={() => handleOctobossAction("octoboss-reorganize-tentacles")}
                >
                  <span className="canvas-context-menu-icon">
                    <Hexagon size={14} />
                  </span>
                  Reorganize Tentacles
                </button>
                <button
                  type="button"
                  className="canvas-context-menu-item"
                  onClick={() => handleOctobossAction("octoboss-clean-contexts")}
                >
                  <span className="canvas-context-menu-icon">
                    <Sparkles size={14} />
                  </span>
                  Clean Tentacle Contexts
                </button>
              </>
            )}
            {contextMenu.kind === "active-session" && (
              <button
                type="button"
                className="canvas-context-menu-item canvas-context-menu-item--danger"
                onClick={() => {
                  onDeleteActiveSession?.(
                    contextMenu.sessionId,
                    contextMenu.label,
                    contextMenu.workspaceMode,
                  );
                  setContextMenu(null);
                }}
              >
                <span className="canvas-context-menu-icon">
                  <Trash2 size={14} />
                </span>
                Delete
              </button>
            )}
          </div>
        </>
      )}

      {pendingDeleteTerminal && onCancelDelete && onConfirmDelete && (
        <div className="canvas-delete-dialog">
          <DeleteTentacleDialog
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
