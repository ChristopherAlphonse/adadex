import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronUp, GitBranch, Hexagon, Layers, ListTodo, Maximize, Pause, Play, RefreshCw, Sparkles, Terminal as TerminalIcon, Trash2, } from "lucide-react";
import { useAgentRuntimeStates } from "../app/hooks/useAgentRuntimeStates";
import { useCanvasGraphData } from "../app/hooks/useCanvasGraphData";
import { useCanvasTransform } from "../app/hooks/useCanvasTransform";
import { useForceSimulation } from "../app/hooks/useForceSimulation";
import { createTerminalRuntimeStateStore, } from "../app/terminalRuntimeStateStore";
import { DeleteOrchestrationDialog } from "./DeleteOrchestrationDialog";
import { CanvasOrchestrationPanel } from "./canvas/CanvasOrchestrationPanel";
import { CanvasTerminalColumn } from "./canvas/CanvasTerminalColumn";
import { DeleteAllTerminalsDialog } from "./canvas/DeleteAllTerminalsDialog";
import { MascotNode } from "./canvas/MascotNode";
import { SessionNode } from "./canvas/SessionNode";
import { WorkspaceSetupCard } from "./deck/WorkspaceSetupCard";
const CLICK_THRESHOLD = 5;
const WORKSPACE_SETUP_OVERLAY_STORAGE_KEY = "adadex.canvas.workspaceSetupOverlay";
const GRAPH_MIN_WIDTH = 300;
const TERMINAL_MIN_WIDTH = 370;
const ACTIVE_SESSION_RADIUS = 12;
const buildActiveSessionNodeId = (terminalId) => `a:${terminalId}`;
const buildOrchestrationNodeId = (coordinationId) => `t:${coordinationId}`;
const buildCanvasEdgePath = (source, target, edgeIndex, edgeCount) => {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1)
        return "";
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
const isEdgeActivityVisible = (target) => target.type === "active-session" &&
    target.hasUserPrompt !== false &&
    target.agentRuntimeState !== undefined &&
    target.agentRuntimeState !== "idle";
const renderEdgeActivityDots = (path, color, keyPrefix) => [0, 1, 2].flatMap((index) => [
    _jsxs("circle", { className: "canvas-edge-activity-dot canvas-edge-activity-dot--trail", r: 4.6, fill: color, opacity: Math.max(0.14, 0.28 - index * 0.04), children: [_jsx("animateMotion", { path: path, begin: `${index * 0.62}s`, dur: "1.9s", repeatCount: "indefinite", rotate: "auto" }), _jsx("animate", { attributeName: "r", values: "3.8;5.2;3.8", dur: "1.9s", begin: `${index * 0.62}s`, repeatCount: "indefinite" })] }, `${keyPrefix}-trail-${index}`),
    _jsxs("circle", { className: "canvas-edge-activity-dot", r: 3.2, fill: "#fff4cc", stroke: color, strokeWidth: 1.2, opacity: Math.max(0.7, 1 - index * 0.08), children: [_jsx("animateMotion", { path: path, begin: `${index * 0.62}s`, dur: "1.9s", repeatCount: "indefinite", rotate: "auto" }), _jsx("animate", { attributeName: "r", values: "2.8;3.8;2.8", dur: "1.9s", begin: `${index * 0.62}s`, repeatCount: "indefinite" })] }, `${keyPrefix}-dot-${index}`),
]);
export const CanvasPrimaryView = ({ columns, runtimeStateStore: providedRuntimeStateStore, isUiStateHydrated, canvasOpenTerminalIds, canvasOpenCoordinationIds, canvasTerminalsPanelWidth: persistedTerminalsPanelWidth, workspaceSetup = null, isWorkspaceSetupLoading = false, workspaceSetupError = null, runningWorkspaceSetupStepId = null, onRunWorkspaceSetupStep, onLaunchWorkspaceSetupPlanner, recentlyCreatedTerminal, onCanvasOpenTerminalIdsChange, onCanvasOpenOrchestrationIdsChange, onCanvasTerminalsPanelWidthChange, onCreateAgent, onCreateTerminal, onCreateWorktreeTerminal, onCreateOrchestration, onSpawnSwarm, onSolveTodoItem, onDeckLeadAction, onOrchestrationAction, onNavigateToConversation, onCloseActiveSession, onDeleteActiveSession, pendingDeleteTerminal, isDeletingTerminalId, onCancelDelete, onConfirmDelete, onTerminalRenamed, onTerminalActivity, onRefreshColumns, }) => {
    const runtimeStateStoreRef = useRef(null);
    if (runtimeStateStoreRef.current === null) {
        runtimeStateStoreRef.current = providedRuntimeStateStore ?? createTerminalRuntimeStateStore();
    }
    const runtimeStateStore = providedRuntimeStateStore ?? runtimeStateStoreRef.current;
    const [selectedNodeId, setSelectedNodeId] = useState(null);
    const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);
    const [openTerminals, setOpenTerminals] = useState(new Map());
    const [openOrchestrations, setOpenOrchestrations] = useState(new Map());
    const [dragNodeId, setDragNodeId] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);
    const [terminalsPanelWidth, setTerminalsPanelWidth] = useState(null);
    const [pendingOpenAgentId, setPendingOpenAgentId] = useState(null);
    const [hideIdleTerminals, setHideIdleTerminals] = useState(false);
    const [isLaunchingWorkspaceSetupPlanner, setIsLaunchingWorkspaceSetupPlanner] = useState(false);
    const hasHydratedTerminals = useRef(false);
    const hasHydratedOrchestrations = useRef(false);
    const lastHandledCreatedTerminalIdRef = useRef(null);
    const dragStartRef = useRef(null);
    const nodeClickedRef = useRef(false);
    const dividerDragRef = useRef(null);
    const containerRef = useRef(null);
    const terminalsPanelRef = useRef(null);
    const panelRefs = useRef(new Map());
    const lastFocusedPanelIdRef = useRef(null);
    const shouldShowWorkspaceSetupCard = Boolean(workspaceSetup?.shouldShowSetupCard);
    const [workspaceSetupOverlay, setWorkspaceSetupOverlay] = useState(() => {
        if (typeof sessionStorage === "undefined") {
            return "expanded";
        }
        const raw = sessionStorage.getItem(WORKSPACE_SETUP_OVERLAY_STORAGE_KEY);
        if (raw === "minimized" || raw === "hidden" || raw === "expanded") {
            return raw;
        }
        return "expanded";
    });
    const incompleteWorkspaceSetupSteps = useMemo(() => (workspaceSetup?.steps ?? []).filter((step) => !step.complete).length, [workspaceSetup]);
    useEffect(() => {
        if (!shouldShowWorkspaceSetupCard) {
            sessionStorage.removeItem(WORKSPACE_SETUP_OVERLAY_STORAGE_KEY);
            setWorkspaceSetupOverlay("expanded");
            return;
        }
        sessionStorage.setItem(WORKSPACE_SETUP_OVERLAY_STORAGE_KEY, workspaceSetupOverlay);
    }, [shouldShowWorkspaceSetupCard, workspaceSetupOverlay]);
    const agentRuntimeStates = useAgentRuntimeStates(runtimeStateStore, columns);
    const { nodes, edges, orchestrationById, sessionsByOrchestrationId, refresh: refreshGraphData, refreshDeckOrchestrations, } = useCanvasGraphData({ columns, enabled: true, agentRuntimeStates });
    const { transform, isPanning, svgRef, handleWheel, handlePointerDown: handleCanvasPointerDown, handlePointerMove: handleCanvasPointerMove, handlePointerUp: handleCanvasPointerUp, screenToGraph, fitAll, } = useCanvasTransform();
    const { simulatedNodes, pinNode, unpinNode, moveNode, reheat } = useForceSimulation({
        nodes,
        edges,
        centerX: 0,
        centerY: 0,
    });
    const nodesById = useMemo(() => {
        const map = new Map();
        for (const n of simulatedNodes) {
            map.set(n.id, n);
        }
        return map;
    }, [simulatedNodes]);
    const resolveActiveSessionNode = useCallback((terminalId) => {
        const nodeId = buildActiveSessionNodeId(terminalId);
        const existingNode = nodesById.get(nodeId);
        const terminal = columns.find((entry) => entry.terminalId === terminalId);
        if (!terminal) {
            return existingNode?.type === "active-session" ? existingNode : null;
        }
        const parentNodeId = terminal.parentTerminalId
            ? buildActiveSessionNodeId(terminal.parentTerminalId)
            : buildOrchestrationNodeId(terminal.coordinationId);
        const anchorNode = existingNode?.type === "active-session"
            ? existingNode
            : (nodesById.get(parentNodeId) ??
                nodesById.get(buildOrchestrationNodeId(terminal.coordinationId)));
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
    }, [columns, nodesById]);
    // Hydrate open terminals after a settling delay so all async data (columns,
    // graph nodes, simulation) has time to land before we attempt the lookup.
    const [isHydratingTerminals, setIsHydratingTerminals] = useState(false);
    useEffect(() => {
        if (hasHydratedTerminals.current)
            return;
        if (!isUiStateHydrated)
            return;
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
        if (isHydratingTerminals)
            return;
        if (!hasHydratedTerminals.current)
            return;
        if (openTerminalCount > 0)
            return;
        if (!canvasOpenTerminalIds || canvasOpenTerminalIds.length === 0)
            return;
        const restoredMap = new Map();
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
        if (!hasHydratedTerminals.current)
            return;
        onCanvasOpenTerminalIdsChange?.(Array.from(openTerminals.keys()));
    }, [openTerminals, onCanvasOpenTerminalIdsChange]);
    useEffect(() => {
        setOpenTerminals((current) => {
            let didChange = false;
            const next = new Map();
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
                const nextNode = {
                    ...node,
                    coordinationId: terminal.coordinationId,
                    label: nextLabel,
                    agentState: terminal.state,
                    hasUserPrompt: terminal.hasUserPrompt ?? false,
                    ...(terminal.workspaceMode ? { workspaceMode: terminal.workspaceMode } : {}),
                    ...(terminal.parentTerminalId ? { parentTerminalId: terminal.parentTerminalId } : {}),
                };
                if (node.label !== nextNode.label ||
                    node.coordinationId !== nextNode.coordinationId ||
                    node.agentState !== nextNode.agentState ||
                    node.hasUserPrompt !== nextNode.hasUserPrompt ||
                    node.workspaceMode !== nextNode.workspaceMode ||
                    node.parentTerminalId !== nextNode.parentTerminalId) {
                    didChange = true;
                    next.set(nodeId, nextNode);
                    continue;
                }
                next.set(nodeId, node);
            }
            return didChange ? next : current;
        });
    }, [columns]);
    // Hydrate open orchestrations from persisted IDs.
    // Gate on orchestration-type nodes being present (deck API fetch is async).
    const hasOrchestrationNodes = simulatedNodes.some((n) => n.type === "orchestration");
    const openOrchestrationCount = openOrchestrations.size;
    useEffect(() => {
        if (hasHydratedOrchestrations.current)
            return;
        if (!isUiStateHydrated)
            return;
        if (!hasOrchestrationNodes)
            return;
        if (canvasOpenCoordinationIds && canvasOpenCoordinationIds.length > 0) {
            const restoredMap = new Map();
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
        hasHydratedOrchestrations.current = true;
    }, [isUiStateHydrated, canvasOpenCoordinationIds, hasOrchestrationNodes, nodesById]);
    // Persist open orchestration IDs when they change
    useEffect(() => {
        if (!hasHydratedOrchestrations.current)
            return;
        onCanvasOpenOrchestrationIdsChange?.(Array.from(openOrchestrations.keys()));
    }, [openOrchestrations, onCanvasOpenOrchestrationIdsChange]);
    // Persist terminals panel width only when user has explicitly dragged the divider
    useEffect(() => {
        if (!hasHydratedTerminals.current)
            return;
        if (terminalsPanelWidth == null)
            return;
        onCanvasTerminalsPanelWidthChange?.(terminalsPanelWidth);
    }, [terminalsPanelWidth, onCanvasTerminalsPanelWidthChange]);
    const handleNodePointerDown = useCallback((e, nodeId) => {
        if (e.button !== 0)
            return;
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        setDragNodeId(nodeId);
        pinNode(nodeId);
        svgRef.current?.setPointerCapture(e.pointerId);
    }, [pinNode, svgRef]);
    const handleSvgPointerMove = useCallback((e) => {
        if (dragNodeId) {
            const graphPos = screenToGraph(e.clientX, e.clientY);
            moveNode(dragNodeId, graphPos.x, graphPos.y);
            return;
        }
        handleCanvasPointerMove(e);
    }, [dragNodeId, screenToGraph, moveNode, handleCanvasPointerMove]);
    const handleNodeClick = useCallback((nodeId) => {
        setSelectedNodeId(nodeId);
        const node = nodesById.get(nodeId);
        if (!node)
            return;
        if (node.type === "active-session") {
            const resolvedNode = node.sessionId
                ? (resolveActiveSessionNode(node.sessionId) ?? node)
                : node;
            setOpenTerminals((prev) => {
                const next = new Map(prev);
                if (next.has(nodeId)) {
                    next.delete(nodeId);
                }
                else {
                    next.set(nodeId, { ...resolvedNode });
                }
                return next;
            });
        }
        else if (node.type === "orchestration" || node.type === "deck-lead") {
            setOpenOrchestrations((prev) => {
                const next = new Map(prev);
                if (next.has(nodeId)) {
                    next.delete(nodeId);
                }
                else {
                    next.set(nodeId, { ...node });
                }
                return next;
            });
        }
        else if (node.type === "inactive-session" && node.sessionId) {
            onNavigateToConversation?.(node.sessionId);
        }
    }, [nodesById, onNavigateToConversation, resolveActiveSessionNode]);
    const setPanelRef = useCallback((nodeId) => (element) => {
        if (element) {
            panelRefs.current.set(nodeId, element);
            return;
        }
        panelRefs.current.delete(nodeId);
    }, []);
    const handlePanelFocus = useCallback((nodeId) => {
        lastFocusedPanelIdRef.current = nodeId;
        setSelectedNodeId(nodeId);
    }, []);
    const handleCloseOrchestration = useCallback((nodeId) => {
        setOpenOrchestrations((prev) => {
            const next = new Map(prev);
            next.delete(nodeId);
            return next;
        });
        setSelectedNodeId((prev) => (prev === nodeId ? null : prev));
    }, []);
    const handleMinimizeTerminal = useCallback((nodeId) => {
        setOpenTerminals((prev) => {
            const next = new Map(prev);
            next.delete(nodeId);
            return next;
        });
        setSelectedNodeId((prev) => (prev === nodeId ? null : prev));
    }, []);
    const handleCloseTerminal = useCallback((node) => {
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
        void onCloseActiveSession?.(node.sessionId, terminal?.coordinationName ?? node.label, terminal?.workspaceMode ?? node.workspaceMode);
    }, [columns, onCloseActiveSession]);
    // Divider drag handlers
    const handleDividerPointerDown = useCallback((e) => {
        e.preventDefault();
        // Measure the actual rendered width of the terminals panel (works whether CSS- or inline-sized)
        const panelEl = e.target.nextElementSibling;
        const currentWidth = panelEl?.clientWidth ?? terminalsPanelWidth ?? 600;
        dividerDragRef.current = { startX: e.clientX, startWidth: currentWidth };
        e.target.setPointerCapture(e.pointerId);
    }, [terminalsPanelWidth]);
    const handleDividerPointerMove = useCallback((e) => {
        const drag = dividerDragRef.current;
        if (!drag)
            return;
        const containerWidth = containerRef.current?.clientWidth ?? 1200;
        // Dragging left → terminals grow, dragging right → terminals shrink
        const delta = drag.startX - e.clientX;
        const newWidth = Math.max(TERMINAL_MIN_WIDTH, Math.min(containerWidth - GRAPH_MIN_WIDTH - 6, drag.startWidth + delta));
        setTerminalsPanelWidth(newWidth);
    }, []);
    const handleDividerPointerUp = useCallback(() => {
        dividerDragRef.current = null;
    }, []);
    // Convert vertical wheel to horizontal scroll only when hovering terminal headers
    useEffect(() => {
        if (!isHydratingTerminals && openTerminalCount === 0 && openOrchestrationCount === 0)
            return;
        const panel = terminalsPanelRef.current;
        if (!panel)
            return;
        const handler = (e) => {
            const target = e.target;
            if (!target?.closest(".canvas-terminal-column-header"))
                return;
            if (e.deltaY !== 0 && e.deltaX === 0) {
                e.preventDefault();
                panel.scrollLeft += e.deltaY;
            }
        };
        panel.addEventListener("wheel", handler, { passive: false });
        return () => panel.removeEventListener("wheel", handler);
    }, [isHydratingTerminals, openTerminalCount, openOrchestrationCount]);
    const handleSvgPointerUp = useCallback((e) => {
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
    }, [dragNodeId, unpinNode, reheat, handleCanvasPointerUp, handleNodeClick]);
    const handleSvgClick = useCallback((e) => {
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
        if (!svg)
            return;
        const handler = (e) => {
            let el = e.target;
            let nodeId = null;
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
            if (!node)
                return;
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
    const handleCreateAgent = useCallback((coordinationId) => {
        if (!onCreateAgent)
            return;
        setContextMenu(null);
        const result = onCreateAgent(coordinationId);
        if (result && typeof result.then === "function") {
            void result.then((agentId) => {
                if (agentId)
                    setPendingOpenAgentId(agentId);
            });
        }
    }, [onCreateAgent]);
    const handleSpawnSwarm = useCallback(async (coordinationId, workspaceMode) => {
        setContextMenu(null);
        await onSpawnSwarm?.(coordinationId, workspaceMode);
        refreshGraphData();
    }, [onSpawnSwarm, refreshGraphData]);
    const handleDeckLeadAction = useCallback((action) => {
        setContextMenu(null);
        const result = onDeckLeadAction?.(action);
        if (result && typeof result.then === "function") {
            void result.then((agentId) => {
                if (agentId)
                    setPendingOpenAgentId(agentId);
            });
        }
    }, [onDeckLeadAction]);
    const handleOrchestrationAction = useCallback((coordinationId, action) => {
        setContextMenu(null);
        const result = onOrchestrationAction?.(coordinationId, action);
        if (result && typeof result.then === "function") {
            void result.then((agentId) => {
                if (agentId)
                    setPendingOpenAgentId(agentId);
            });
        }
    }, [onOrchestrationAction]);
    // Auto-open terminal for newly created agent once it appears in the graph
    useEffect(() => {
        if (!pendingOpenAgentId)
            return;
        const nodeId = buildActiveSessionNodeId(pendingOpenAgentId);
        const node = resolveActiveSessionNode(pendingOpenAgentId);
        if (!node)
            return;
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
    // Separate orchestration and session nodes for render order
    const orchestrationNodes = simulatedNodes.filter((n) => n.type === "orchestration" || n.type === "deck-lead");
    const sessionNodes = simulatedNodes.filter((n) => {
        if (n.type === "orchestration" || n.type === "deck-lead")
            return false;
        if (hideIdleTerminals && n.type === "inactive-session")
            return false;
        if (hideIdleTerminals &&
            n.type === "active-session" &&
            (n.agentState === "idle" || n.hasUserPrompt === false))
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
    const waitingNodes = simulatedNodes.filter((n) => n.type === "active-session" &&
        (n.agentRuntimeState === "waiting_for_permission" ||
            n.agentRuntimeState === "waiting_for_user"));
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
        if (hideIdleTerminals &&
            (source.agentState === "idle" ||
                source.hasUserPrompt === false ||
                target.agentState === "idle" ||
                target.hasUserPrompt === false)) {
            return null;
        }
        return { source, target };
    })
        .filter((edge) => edge !== null);
    const sessionEdgesBySource = new Map();
    for (const edge of sessionEdges) {
        const group = sessionEdgesBySource.get(edge.source.id);
        if (group) {
            group.push(edge);
        }
        else {
            sessionEdgesBySource.set(edge.source.id, [edge]);
        }
    }
    for (const group of sessionEdgesBySource.values()) {
        group.sort((left, right) => {
            const leftAngle = Math.atan2(left.target.y - left.source.y, left.target.x - left.source.x);
            const rightAngle = Math.atan2(right.target.y - right.source.y, right.target.x - right.source.x);
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
        }
        finally {
            setIsLaunchingWorkspaceSetupPlanner(false);
        }
    }, [onLaunchWorkspaceSetupPlanner]);
    return (_jsxs("section", { ref: containerRef, className: "canvas-view", "aria-label": "Canvas graph view", children: [_jsxs("div", { className: `canvas-graph-panel${hasPanels ? " canvas-graph-panel--split" : ""}`, children: [_jsxs("svg", { "aria-label": "Canvas graph", ref: svgRef, className: `canvas-svg${isPanning || dragNodeId ? " canvas-svg--panning" : ""}`, onWheel: handleWheel, onPointerDown: handleCanvasPointerDown, onPointerMove: handleSvgPointerMove, onPointerUp: handleSvgPointerUp, onClick: handleSvgClick, onKeyDown: (e) => {
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
                        }, children: [_jsx("title", { children: "Canvas graph" }), _jsxs("g", { transform: `translate(${transform.translateX}, ${transform.translateY}) scale(${transform.scale})`, children: [Array.from(sessionEdgesBySource.entries()).flatMap(([sourceId, group]) => group.map(({ source, target }, index) => {
                                        const active = selectedNodeId === source.id || selectedNodeId === target.id;
                                        const selectedColor = selectedNodeId
                                            ? (nodesById.get(selectedNodeId)?.color ?? null)
                                            : null;
                                        const path = buildCanvasEdgePath(source, target, index, group.length);
                                        return (_jsxs("g", { children: [_jsx("path", { className: "canvas-edge", d: path, fill: "none", stroke: active ? (selectedColor ?? source.color) : "#C0C0C0", strokeWidth: active ? 2 : 1.5, strokeOpacity: 1 }), isEdgeActivityVisible(target)
                                                    ? renderEdgeActivityDots(path, active ? (selectedColor ?? source.color) : source.color, `${sourceId}->${target.id}`)
                                                    : null] }, `${sourceId}->${target.id}`));
                                    })), orchestrationNodes.map((node) => {
                                        const connected = edges
                                            .filter((e) => e.source === node.id)
                                            .map((e) => nodesById.get(e.target))
                                            .filter((n) => {
                                            if (!n)
                                                return false;
                                            if (hideIdleTerminals && n.type === "inactive-session")
                                                return false;
                                            if (hideIdleTerminals &&
                                                n.type === "active-session" &&
                                                (n.agentState === "idle" || n.hasUserPrompt === false))
                                                return false;
                                            return true;
                                        });
                                        const selectedColor = selectedNodeId
                                            ? (nodesById.get(selectedNodeId)?.color ?? null)
                                            : null;
                                        return (_jsx(MascotNode, { node: node, connectedNodes: connected, isSelected: selectedNodeId === node.id, selectedNodeId: selectedNodeId, selectedNodeColor: selectedColor, graphScale: transform.scale, onPointerDown: handleNodePointerDown, onClick: handleNodeClick }, node.id));
                                    }), sessionNodes.map((node) => (_jsx(SessionNode, { node: node, isSelected: selectedNodeId === node.id, onPointerDown: handleNodePointerDown, onClick: handleNodeClick }, node.id)))] })] }), _jsxs("div", { className: "canvas-toolbar", role: "toolbar", "aria-label": "Canvas actions", children: [_jsxs("button", { type: "button", className: "canvas-toolbar-btn", onClick: () => {
                                    const result = onCreateTerminal?.();
                                    if (result && typeof result.then === "function") {
                                        void result.then((agentId) => {
                                            if (agentId)
                                                setPendingOpenAgentId(agentId);
                                        });
                                    }
                                }, children: [_jsx("span", { className: "canvas-toolbar-icon", children: _jsx(TerminalIcon, { size: 14 }) }), _jsx("span", { className: "canvas-toolbar-label", children: "Terminal" })] }), _jsxs("button", { type: "button", className: "canvas-toolbar-btn", onClick: () => {
                                    const result = onCreateWorktreeTerminal?.();
                                    if (result && typeof result.then === "function") {
                                        void result.then((agentId) => {
                                            if (agentId)
                                                setPendingOpenAgentId(agentId);
                                        });
                                    }
                                }, children: [_jsx("span", { className: "canvas-toolbar-icon", children: _jsx(GitBranch, { size: 14 }) }), _jsx("span", { className: "canvas-toolbar-label", children: "Worktree" })] }), _jsxs("button", { type: "button", className: "canvas-toolbar-btn", onClick: onCreateOrchestration, children: [_jsx("span", { className: "canvas-toolbar-icon", children: _jsx(Hexagon, { size: 14 }) }), _jsx("span", { className: "canvas-toolbar-label", children: "Orchestration" })] }), _jsx("div", { className: "canvas-toolbar-separator" }), _jsxs("button", { type: "button", className: "canvas-toolbar-btn", onClick: handleFitView, children: [_jsx("span", { className: "canvas-toolbar-icon", children: _jsx(Maximize, { size: 14 }) }), _jsx("span", { className: "canvas-toolbar-label", children: "Fit" })] }), _jsxs("button", { type: "button", className: "canvas-toolbar-btn", onClick: handleRefresh, children: [_jsx("span", { className: "canvas-toolbar-icon", children: _jsx(RefreshCw, { size: 14 }) }), _jsx("span", { className: "canvas-toolbar-label", children: "Refresh" })] }), _jsx("div", { className: "canvas-toolbar-separator" }), _jsxs("button", { type: "button", className: `canvas-toolbar-btn${hideIdleTerminals ? " canvas-toolbar-btn--active" : ""}`, onClick: () => setHideIdleTerminals((prev) => !prev), children: [_jsx("span", { className: "canvas-toolbar-icon", children: hideIdleTerminals ? _jsx(Play, { size: 14 }) : _jsx(Pause, { size: 14 }) }), _jsx("span", { className: "canvas-toolbar-label", children: hideIdleTerminals ? "Show Idle" : "Hide Idle" })] }), shouldShowWorkspaceSetupCard && workspaceSetupOverlay === "hidden" ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "canvas-toolbar-separator" }), _jsxs("button", { type: "button", className: "canvas-toolbar-btn", onClick: () => setWorkspaceSetupOverlay("expanded"), children: [_jsx("span", { className: "canvas-toolbar-icon", children: _jsx(ListTodo, { size: 14 }) }), _jsx("span", { className: "canvas-toolbar-label", children: "Setup" })] })] })) : null, _jsx("div", { className: "canvas-toolbar-separator" }), _jsxs("button", { type: "button", className: "canvas-toolbar-btn canvas-toolbar-btn--danger", onClick: () => setIsDeleteAllDialogOpen(true), children: [_jsx("span", { className: "canvas-toolbar-icon", children: _jsx(Trash2, { size: 14 }) }), _jsx("span", { className: "canvas-toolbar-label", children: "Delete All" })] })] }), waitingNodes.length > 0 && (_jsx("div", { className: "canvas-waiting-list", children: waitingNodes.map((node) => {
                            const nameRaw = node.label;
                            const name = nameRaw.length > 20 ? `${nameRaw.slice(0, 20)}…` : nameRaw;
                            const prefix = node.agentRuntimeState === "waiting_for_permission"
                                ? `${node.waitingToolName ?? "Permission"}: `
                                : "Waiting: ";
                            return (_jsx("button", { type: "button", className: "canvas-waiting-bar", onClick: () => handleNodeClick(node.id), children: _jsxs("span", { className: "canvas-waiting-bar-name", children: [_jsx("span", { className: "canvas-waiting-bar-prefix", children: prefix }), name] }) }, node.id));
                        }) })), shouldShowWorkspaceSetupCard && workspaceSetupOverlay === "expanded" ? (_jsx("div", { className: "canvas-setup-overlay", children: _jsx(WorkspaceSetupCard, { workspaceSetup: workspaceSetup, isLoading: isWorkspaceSetupLoading, error: workspaceSetupError, onRunStep: (stepId) => {
                                void onRunWorkspaceSetupStep?.(stepId);
                            }, onLaunchAgent: () => {
                                void handleLaunchWorkspaceSetupPlanner();
                            }, isLaunchingAgent: isLaunchingWorkspaceSetupPlanner, isRunningStepId: runningWorkspaceSetupStepId, onMinimize: () => setWorkspaceSetupOverlay("minimized"), onDismiss: () => setWorkspaceSetupOverlay("hidden") }) })) : null, shouldShowWorkspaceSetupCard && workspaceSetupOverlay === "minimized" ? (_jsx("div", { className: "canvas-setup-overlay canvas-setup-overlay--minimized", children: _jsxs("button", { type: "button", className: "workspace-setup-minimized-bar", "aria-label": incompleteWorkspaceSetupSteps > 0
                                ? `Expand workspace setup, ${incompleteWorkspaceSetupSteps} steps incomplete`
                                : "Expand workspace setup", onClick: () => setWorkspaceSetupOverlay("expanded"), children: [_jsx(ListTodo, { size: 16, strokeWidth: 2, "aria-hidden": true }), _jsxs("span", { className: "workspace-setup-minimized-bar-label", children: ["Workspace setup", incompleteWorkspaceSetupSteps > 0
                                            ? ` · ${incompleteWorkspaceSetupSteps} incomplete`
                                            : ""] }), _jsx(ChevronUp, { size: 16, strokeWidth: 2, "aria-hidden": true })] }) })) : null] }), hasPanels && (_jsxs(_Fragment, { children: [_jsx("div", { className: "canvas-panel-divider", role: "separator", "aria-orientation": "vertical", tabIndex: 0, onPointerDown: handleDividerPointerDown, onPointerMove: handleDividerPointerMove, onPointerUp: handleDividerPointerUp }), _jsxs("div", { ref: terminalsPanelRef, className: "canvas-terminals-panel", style: terminalsPanelWidth != null ? { flex: `0 0 ${terminalsPanelWidth}px` } : undefined, children: [Array.from(openOrchestrations.entries()).map(([nodeId, node]) => (_jsx(CanvasOrchestrationPanel, { node: node, isFocused: selectedNodeId === nodeId, panelRef: setPanelRef(nodeId), orchestration: orchestrationById.get(node.coordinationId) ?? null, sessions: sessionsByOrchestrationId.get(node.coordinationId) ?? [], onClose: () => handleCloseOrchestration(nodeId), onFocus: () => handlePanelFocus(nodeId), onCreateAgent: (coordinationId) => {
                                    handleCreateAgent(coordinationId);
                                }, onSolveTodoItem: (coordinationId, itemIndex) => {
                                    void onSolveTodoItem?.(coordinationId, itemIndex);
                                }, onSpawnSwarm: (coordinationId, workspaceMode) => {
                                    return handleSpawnSwarm(coordinationId, workspaceMode);
                                }, onNavigateToConversation: onNavigateToConversation, onRefreshOrchestrationData: refreshDeckOrchestrations }, nodeId))), isHydratingTerminals && openTerminals.size === 0 && (_jsxs("div", { className: "canvas-terminal-skeleton", children: [_jsx("div", { className: "canvas-terminal-skeleton__header" }), _jsxs("div", { className: "canvas-terminal-skeleton__body", children: [_jsx("div", { className: "canvas-terminal-skeleton__line", style: { width: "60%" } }), _jsx("div", { className: "canvas-terminal-skeleton__line", style: { width: "80%" } }), _jsx("div", { className: "canvas-terminal-skeleton__line", style: { width: "45%" } })] })] })), Array.from(openTerminals.entries()).map(([nodeId, node]) => (_jsx(CanvasTerminalColumn, { node: node, terminals: columns, layoutVersion: terminalLayoutVersion, isFocused: selectedNodeId === nodeId, panelRef: setPanelRef(nodeId), onMinimize: () => handleMinimizeTerminal(nodeId), onClose: () => handleCloseTerminal(node), onFocus: () => handlePanelFocus(nodeId), onTerminalRenamed: onTerminalRenamed, onTerminalActivity: onTerminalActivity }, nodeId)))] })] })), contextMenu && (_jsxs(_Fragment, { children: [_jsx("div", { "aria-label": "Close canvas context menu", className: "canvas-context-menu-backdrop", onClick: () => setContextMenu(null), onContextMenu: (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // Close current menu, then re-derive what's under the cursor on the SVG
                            setContextMenu(null);
                            // Use rAF so the backdrop is removed before we probe elementFromPoint
                            requestAnimationFrame(() => {
                                const under = document.elementFromPoint(e.clientX, e.clientY);
                                if (under) {
                                    under.dispatchEvent(new MouseEvent("contextmenu", {
                                        bubbles: true,
                                        clientX: e.clientX,
                                        clientY: e.clientY,
                                    }));
                                }
                            });
                        }, onKeyDown: (e) => {
                            if (e.key !== "Enter" && e.key !== " " && e.key !== "Escape")
                                return;
                            e.preventDefault();
                            setContextMenu(null);
                        }, role: "button", tabIndex: 0 }), _jsxs("div", { className: "canvas-context-menu", style: { left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }, onContextMenu: (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setContextMenu(null);
                            requestAnimationFrame(() => {
                                const under = document.elementFromPoint(e.clientX, e.clientY);
                                if (under) {
                                    under.dispatchEvent(new MouseEvent("contextmenu", {
                                        bubbles: true,
                                        clientX: e.clientX,
                                        clientY: e.clientY,
                                    }));
                                }
                            });
                        }, children: [contextMenu.kind === "canvas" && (_jsxs(_Fragment, { children: [_jsxs("button", { type: "button", className: "canvas-context-menu-item", onClick: () => {
                                            setContextMenu(null);
                                            onCreateOrchestration?.();
                                        }, children: [_jsx("span", { className: "canvas-context-menu-icon", children: _jsx(Hexagon, { size: 14 }) }), "New Orchestration"] }), _jsxs("button", { type: "button", className: "canvas-context-menu-item", onClick: () => {
                                            setContextMenu(null);
                                            const result = onCreateTerminal?.();
                                            if (result && typeof result.then === "function") {
                                                void result.then((agentId) => {
                                                    if (agentId)
                                                        setPendingOpenAgentId(agentId);
                                                });
                                            }
                                        }, children: [_jsx("span", { className: "canvas-context-menu-icon", children: _jsx(TerminalIcon, { size: 14 }) }), "New Terminal"] }), _jsxs("button", { type: "button", className: "canvas-context-menu-item", onClick: () => {
                                            setContextMenu(null);
                                            const result = onCreateWorktreeTerminal?.();
                                            if (result && typeof result.then === "function") {
                                                void result.then((agentId) => {
                                                    if (agentId)
                                                        setPendingOpenAgentId(agentId);
                                                });
                                            }
                                        }, children: [_jsx("span", { className: "canvas-context-menu-icon", children: _jsx(GitBranch, { size: 14 }) }), "New Worktree Terminal"] })] })), contextMenu.kind === "orchestration" && (_jsxs(_Fragment, { children: [_jsxs("button", { type: "button", className: "canvas-context-menu-item", onClick: () => handleCreateAgent(contextMenu.coordinationId), children: [_jsx("span", { className: "canvas-context-menu-icon", children: _jsx(TerminalIcon, { size: 14 }) }), "Create new agent"] }), _jsxs("button", { type: "button", className: "canvas-context-menu-item", onClick: () => {
                                            setContextMenu(null);
                                            const result = onCreateWorktreeTerminal?.();
                                            if (result && typeof result.then === "function") {
                                                void result.then((agentId) => {
                                                    if (agentId)
                                                        setPendingOpenAgentId(agentId);
                                                });
                                            }
                                        }, children: [_jsx("span", { className: "canvas-context-menu-icon", children: _jsx(GitBranch, { size: 14 }) }), "New Worktree Terminal"] }), _jsxs("button", { type: "button", className: "canvas-context-menu-item", onClick: () => handleOrchestrationAction(contextMenu.coordinationId, "coordination-reorganize-todos"), children: [_jsx("span", { className: "canvas-context-menu-icon", children: _jsx(ListTodo, { size: 14 }) }), "Update To-Do List"] }), _jsxs("button", { type: "button", className: "canvas-context-menu-item", onClick: () => handleOrchestrationAction(contextMenu.coordinationId, "coordination-update"), children: [_jsx("span", { className: "canvas-context-menu-icon", children: _jsx(Hexagon, { size: 14 }) }), "Update Orchestration"] }), _jsxs("button", { type: "button", className: "canvas-context-menu-item", onClick: () => {
                                            void handleSpawnSwarm(contextMenu.coordinationId, "worktree");
                                        }, children: [_jsx("span", { className: "canvas-context-menu-icon", children: _jsx(Layers, { size: 14 }) }), "Spawn Swarm (Worktrees)"] }), _jsxs("button", { type: "button", className: "canvas-context-menu-item", onClick: () => {
                                            void handleSpawnSwarm(contextMenu.coordinationId, "shared");
                                        }, children: [_jsx("span", { className: "canvas-context-menu-icon", children: _jsx(Layers, { size: 14 }) }), "Spawn Swarm (Normal)"] })] })), contextMenu.kind === "deck-lead" && (_jsxs(_Fragment, { children: [_jsxs("button", { type: "button", className: "canvas-context-menu-item", onClick: () => handleDeckLeadAction("deck-lead-reorganize-todos"), children: [_jsx("span", { className: "canvas-context-menu-icon", children: _jsx(ListTodo, { size: 14 }) }), "Reorganize To-Do's"] }), _jsxs("button", { type: "button", className: "canvas-context-menu-item", onClick: () => handleDeckLeadAction("deck-lead-reorganize-coordinations"), children: [_jsx("span", { className: "canvas-context-menu-icon", children: _jsx(Hexagon, { size: 14 }) }), "Reorganize Coordinations"] }), _jsxs("button", { type: "button", className: "canvas-context-menu-item", onClick: () => handleDeckLeadAction("deck-lead-clean-contexts"), children: [_jsx("span", { className: "canvas-context-menu-icon", children: _jsx(Sparkles, { size: 14 }) }), "Clean Coordination Contexts"] })] })), contextMenu.kind === "active-session" && (_jsxs("button", { type: "button", className: "canvas-context-menu-item canvas-context-menu-item--danger", onClick: () => {
                                    onDeleteActiveSession?.(contextMenu.sessionId, contextMenu.label, contextMenu.workspaceMode);
                                    setContextMenu(null);
                                }, children: [_jsx("span", { className: "canvas-context-menu-icon", children: _jsx(Trash2, { size: 14 }) }), "Delete"] }))] })] })), pendingDeleteTerminal && onCancelDelete && onConfirmDelete && (_jsx("div", { className: "canvas-delete-dialog", children: _jsx(DeleteOrchestrationDialog, { pendingDeleteTerminal: pendingDeleteTerminal, isDeletingTerminalId: isDeletingTerminalId ?? null, onCancel: onCancelDelete, onConfirmDelete: onConfirmDelete }) })), isDeleteAllDialogOpen && (_jsx("div", { className: "canvas-delete-dialog", children: _jsx(DeleteAllTerminalsDialog, { columns: columns, nodes: nodes, onCancel: () => setIsDeleteAllDialogOpen(false), onDeleted: ({ hadFailures }) => {
                        if (!hadFailures) {
                            setIsDeleteAllDialogOpen(false);
                        }
                        setOpenTerminals(new Map());
                        void onRefreshColumns?.();
                        refreshGraphData();
                    } }) }))] }));
};
