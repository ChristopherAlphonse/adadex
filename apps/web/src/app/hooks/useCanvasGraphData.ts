import { useCallback, useEffect, useRef, useState } from "react";

import type { DeckCoordinationSummary } from "@adadex/core";
import { buildConversationsUrl, buildDeckTentaclesUrl } from "../../runtime/runtimeEndpoints";
import type { GraphEdge, GraphNode } from "../canvas/types";
import { normalizeConversationSessionSummary } from "../conversationNormalizers";
import type { ConversationSessionSummary, TerminalView } from "../types";
import type { AgentRuntimeStateInfo } from "./useAgentRuntimeStates";

const TENTACLE_RADIUS = 40;
const ACTIVE_SESSION_RADIUS = 12;
const INACTIVE_SESSION_RADIUS = 10;

const OCTOBOSS_RADIUS = 52;
export const OCTOBOSS_ID = "__octoboss__";
const OCTOBOSS_NODE_ID = `t:${OCTOBOSS_ID}`;

const getAccentPrimary = (): string =>
  (typeof document !== "undefined"
    ? getComputedStyle(document.documentElement).getPropertyValue("--accent-primary").trim()
    : "") || "#d4a017";

// Must match the Deck tab's OCTOPUS_COLORS for consistent tentacle colors
const OCTOPUS_COLORS = [
  "#ff6b2b",
  "#ff2d6b",
  "#00ffaa",
  "#bf5fff",
  "#00c8ff",
  "#ffee00",
  "#39ff14",
  "#ff4df0",
  "#00fff7",
  "#ff9500",
];

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const tentacleColor = (coordinationId: string, deckColor: string | null | undefined) =>
  deckColor && deckColor.length > 0
    ? deckColor
    : (OCTOPUS_COLORS[hashString(coordinationId) % OCTOPUS_COLORS.length] as string);

type UseCanvasGraphDataOptions = {
  columns: TerminalView;
  enabled: boolean;
  agentRuntimeStates?: Map<string, AgentRuntimeStateInfo>;
};

type UseCanvasGraphDataResult = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  tentacleById: ReadonlyMap<string, DeckCoordinationSummary>;
  sessionsByTentacleId: ReadonlyMap<string, ConversationSessionSummary[]>;
  refresh: () => Promise<void>;
  refreshDeckTentacles: () => Promise<void>;
};

const buildTentacleNodeId = (coordinationId: string) => `t:${coordinationId}`;
const buildActiveSessionNodeId = (agentId: string) => `a:${agentId}`;
const buildInactiveSessionNodeId = (sessionId: string) => `i:${sessionId}`;

const normalizeDeckCoordinationSummary = (value: unknown): DeckCoordinationSummary | null => {
  if (value === null || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.coordinationId !== "string") {
    return null;
  }

  const todoItems = Array.isArray(record.todoItems)
    ? record.todoItems
        .map((item) => {
          if (item === null || typeof item !== "object") {
            return null;
          }

          const todoRecord = item as Record<string, unknown>;
          if (typeof todoRecord.text !== "string") {
            return null;
          }

          return {
            text: todoRecord.text,
            done: todoRecord.done === true,
          };
        })
        .filter((item): item is { text: string; done: boolean } => item !== null)
    : [];

  const scopeRecord =
    record.scope !== null && typeof record.scope === "object"
      ? (record.scope as Record<string, unknown>)
      : null;
  const octopusRecord =
    record.octopus !== null && typeof record.octopus === "object"
      ? (record.octopus as Record<string, unknown>)
      : null;

  const status =
    record.status === "idle" ||
    record.status === "active" ||
    record.status === "blocked" ||
    record.status === "needs-review"
      ? record.status
      : "idle";

  return {
    coordinationId: record.coordinationId,
    displayName:
      typeof record.displayName === "string" ? record.displayName : record.coordinationId,
    description: typeof record.description === "string" ? record.description : "",
    status,
    color: typeof record.color === "string" ? record.color : null,
    octopus: {
      animation: typeof octopusRecord?.animation === "string" ? octopusRecord.animation : null,
      expression: typeof octopusRecord?.expression === "string" ? octopusRecord.expression : null,
      accessory: typeof octopusRecord?.accessory === "string" ? octopusRecord.accessory : null,
      hairColor: typeof octopusRecord?.hairColor === "string" ? octopusRecord.hairColor : null,
    },
    scope: {
      paths: Array.isArray(scopeRecord?.paths)
        ? scopeRecord.paths.filter((path): path is string => typeof path === "string")
        : [],
      tags: Array.isArray(scopeRecord?.tags)
        ? scopeRecord.tags.filter((tag): tag is string => typeof tag === "string")
        : [],
    },
    vaultFiles: Array.isArray(record.vaultFiles)
      ? record.vaultFiles.filter((file): file is string => typeof file === "string")
      : [],
    todoTotal:
      typeof record.todoTotal === "number" && Number.isFinite(record.todoTotal)
        ? record.todoTotal
        : todoItems.length,
    todoDone:
      typeof record.todoDone === "number" && Number.isFinite(record.todoDone)
        ? record.todoDone
        : todoItems.filter((item) => item.done).length,
    todoItems,
    suggestedSkills: Array.isArray(record.suggestedSkills)
      ? record.suggestedSkills.filter((skill): skill is string => typeof skill === "string")
      : [],
  };
};

export const useCanvasGraphData = ({
  columns,
  enabled,
  agentRuntimeStates,
}: UseCanvasGraphDataOptions): UseCanvasGraphDataResult => {
  const [deckTentacles, setDeckTentacles] = useState<DeckCoordinationSummary[]>([]);
  const [inactiveSessions, setInactiveSessions] = useState<ConversationSessionSummary[]>([]);
  const prevNodesRef = useRef<Map<string, GraphNode>>(new Map());

  const fetchDeckTentacles = useCallback(async () => {
    try {
      const response = await fetch(buildDeckTentaclesUrl(), {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return;
      const payload = (await response.json()) as unknown;
      if (!Array.isArray(payload)) return;
      const items = payload
        .map((entry) => normalizeDeckCoordinationSummary(entry))
        .filter((entry): entry is DeckCoordinationSummary => entry !== null);
      setDeckTentacles(items);
    } catch {
      // silent
    }
  }, []);

  const fetchInactiveSessions = useCallback(async () => {
    try {
      const response = await fetch(buildConversationsUrl(), {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return;
      const payload = (await response.json()) as unknown;
      const normalized = Array.isArray(payload)
        ? payload
            .map((entry) => normalizeConversationSessionSummary(entry))
            .filter((entry): entry is ConversationSessionSummary => entry !== null)
        : [];
      setInactiveSessions(normalized);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setDeckTentacles([]);
      setInactiveSessions([]);
      return;
    }
    void fetchDeckTentacles();
    void fetchInactiveSessions();
  }, [enabled, fetchDeckTentacles, fetchInactiveSessions]);

  const refresh = useCallback(async () => {
    await Promise.all([fetchDeckTentacles(), fetchInactiveSessions()]);
  }, [fetchDeckTentacles, fetchInactiveSessions]);
  const refreshDeckTentacles = useCallback(async () => {
    await fetchDeckTentacles();
  }, [fetchDeckTentacles]);

  const activeTerminalIds = new Set(columns.map((terminal) => terminal.terminalId));

  // Build a map of deck tentacles for color/label lookup
  const deckMap = new Map<string, DeckCoordinationSummary>();
  for (const dt of deckTentacles) {
    deckMap.set(dt.coordinationId, dt);
  }

  const sessionsByTentacleId = new Map<string, ConversationSessionSummary[]>();
  for (const session of inactiveSessions) {
    if (!session.coordinationId) {
      continue;
    }
    const tentacleSessions = sessionsByTentacleId.get(session.coordinationId);
    if (tentacleSessions) {
      tentacleSessions.push(session);
    } else {
      sessionsByTentacleId.set(session.coordinationId, [session]);
    }
  }

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const prevNodes = prevNodesRef.current;
  const currentNodesById = new Map<string, GraphNode>();
  const seenTentacleIds = new Set<string>();

  // Build a map of active terminals by coordinationId (multiple terminals can share a tentacle)
  const activeTerminalsByTentacle = new Map<string, TerminalView>();
  for (const terminal of columns) {
    const group = activeTerminalsByTentacle.get(terminal.coordinationId);
    if (group) {
      group.push(terminal);
    } else {
      activeTerminalsByTentacle.set(terminal.coordinationId, [terminal]);
    }
  }

  // Build tentacle list: only deck tentacles (sandbox and other non-deck
  // terminals are excluded from the graph).
  const allTentacleIds: string[] = [];
  for (const dt of deckTentacles) {
    allTentacleIds.push(dt.coordinationId);
    seenTentacleIds.add(dt.coordinationId);
  }

  const totalTentacles = allTentacleIds.length;

  for (let i = 0; i < allTentacleIds.length; i++) {
    const coordinationId = allTentacleIds[i];
    if (!coordinationId) continue;
    const tentacleNodeId = buildTentacleNodeId(coordinationId);
    const prev = prevNodes.get(tentacleNodeId);
    const deck = deckMap.get(coordinationId);
    const activeTerminals = activeTerminalsByTentacle.get(coordinationId);
    const firstActiveTerminal = activeTerminals?.[0];
    const color = tentacleColor(coordinationId, deck?.color);
    const label = deck?.displayName ?? firstActiveTerminal?.coordinationName ?? coordinationId;

    const angle = (2 * Math.PI * i) / Math.max(totalTentacles, 1);
    const spread = 300;

    const node: GraphNode = {
      id: tentacleNodeId,
      type: "tentacle",
      x: prev?.x ?? Math.cos(angle) * spread,
      y: prev?.y ?? Math.sin(angle) * spread,
      vx: prev?.vx ?? 0,
      vy: prev?.vy ?? 0,
      pinned: prev?.pinned ?? false,
      radius: TENTACLE_RADIUS,
      coordinationId,
      label,
      color,
      ...(firstActiveTerminal ? { workspaceMode: firstActiveTerminal.workspaceMode } : {}),
      ...(deck?.octopus ? { octopus: deck.octopus } : {}),
    };
    nodes.push(node);
    currentNodesById.set(tentacleNodeId, node);

    // Active terminal session nodes — one per terminal in this tentacle
    if (activeTerminals) {
      for (const activeTerminal of activeTerminals) {
        const sessionNodeId = buildActiveSessionNodeId(activeTerminal.terminalId);
        const prevSession = prevNodes.get(sessionNodeId);
        const parentNodeId = activeTerminal.parentTerminalId
          ? buildActiveSessionNodeId(activeTerminal.parentTerminalId)
          : tentacleNodeId;
        const parentNode = currentNodesById.get(parentNodeId) ?? node;
        const jitter = () => (Math.random() - 0.5) * 60;

        const runtimeInfo = agentRuntimeStates?.get(activeTerminal.terminalId);
        const sessionNode: GraphNode = {
          id: sessionNodeId,
          type: "active-session",
          x: prevSession?.x ?? parentNode.x + jitter(),
          y: prevSession?.y ?? parentNode.y + jitter(),
          vx: prevSession?.vx ?? 0,
          vy: prevSession?.vy ?? 0,
          pinned: prevSession?.pinned ?? false,
          radius: ACTIVE_SESSION_RADIUS,
          coordinationId,
          label: activeTerminal.coordinationName || activeTerminal.terminalId,
          color,
          sessionId: activeTerminal.terminalId,
          agentState: activeTerminal.state,
          hasUserPrompt: activeTerminal.hasUserPrompt ?? false,
          ...(activeTerminal.workspaceMode ? { workspaceMode: activeTerminal.workspaceMode } : {}),
          ...(activeTerminal.parentTerminalId
            ? { parentTerminalId: activeTerminal.parentTerminalId }
            : {}),
          ...(runtimeInfo ? { agentRuntimeState: runtimeInfo.state } : {}),
          ...(runtimeInfo?.toolName ? { waitingToolName: runtimeInfo.toolName } : {}),
        };
        nodes.push(sessionNode);
        currentNodesById.set(sessionNodeId, sessionNode);
        edges.push({ source: parentNodeId, target: sessionNodeId });
      }
    }
  }

  // Octoboss — synthetic always-present node
  const prevBoss = prevNodes.get(OCTOBOSS_NODE_ID);
  const octobossColor = getAccentPrimary();
  const octobossNode: GraphNode = {
    id: OCTOBOSS_NODE_ID,
    type: "octoboss",
    x: prevBoss?.x ?? 0,
    y: prevBoss?.y ?? 0,
    vx: prevBoss?.vx ?? 0,
    vy: prevBoss?.vy ?? 0,
    pinned: prevBoss?.pinned ?? false,
    radius: OCTOBOSS_RADIUS,
    coordinationId: OCTOBOSS_ID,
    label: "Octoboss",
    color: octobossColor,
  };
  nodes.push(octobossNode);
  currentNodesById.set(OCTOBOSS_NODE_ID, octobossNode);

  // Connect octoboss to every tentacle node
  for (const coordinationId of allTentacleIds) {
    edges.push({ source: OCTOBOSS_NODE_ID, target: buildTentacleNodeId(coordinationId) });
  }

  // Link active terminals belonging to octoboss
  for (const terminal of columns) {
    if (terminal.coordinationId !== OCTOBOSS_ID) continue;
    const sessionNodeId = buildActiveSessionNodeId(terminal.terminalId);
    const prevSession = prevNodes.get(sessionNodeId);
    const jitter = () => (Math.random() - 0.5) * 60;

    const bossRuntimeInfo = agentRuntimeStates?.get(terminal.terminalId);
    const sessionNode: GraphNode = {
      id: sessionNodeId,
      type: "active-session",
      x: prevSession?.x ?? octobossNode.x + jitter(),
      y: prevSession?.y ?? octobossNode.y + jitter(),
      vx: prevSession?.vx ?? 0,
      vy: prevSession?.vy ?? 0,
      pinned: prevSession?.pinned ?? false,
      radius: ACTIVE_SESSION_RADIUS,
      coordinationId: OCTOBOSS_ID,
      label: terminal.coordinationName || terminal.terminalId,
      color: octobossColor,
      sessionId: terminal.terminalId,
      agentState: terminal.state,
      hasUserPrompt: terminal.hasUserPrompt ?? false,
      ...(terminal.workspaceMode ? { workspaceMode: terminal.workspaceMode } : {}),
      ...(terminal.parentTerminalId ? { parentTerminalId: terminal.parentTerminalId } : {}),
      ...(bossRuntimeInfo ? { agentRuntimeState: bossRuntimeInfo.state } : {}),
      ...(bossRuntimeInfo?.toolName ? { waitingToolName: bossRuntimeInfo.toolName } : {}),
    };
    nodes.push(sessionNode);
    currentNodesById.set(sessionNodeId, sessionNode);
    edges.push({ source: OCTOBOSS_NODE_ID, target: sessionNodeId });
  }

  // Inactive sessions from conversations
  for (const session of inactiveSessions) {
    if (!session.coordinationId || !seenTentacleIds.has(session.coordinationId)) continue;
    if (activeTerminalIds.has(session.sessionId)) continue;

    const tentacleNodeId = buildTentacleNodeId(session.coordinationId);
    const sessionNodeId = buildInactiveSessionNodeId(session.sessionId);
    const prevSession = prevNodes.get(sessionNodeId);

    const parentNode = nodes.find((n) => n.id === tentacleNodeId);
    const parentX = parentNode?.x ?? 0;
    const parentY = parentNode?.y ?? 0;
    const color = tentacleColor(session.coordinationId, deckMap.get(session.coordinationId)?.color);
    const jitter = () => (Math.random() - 0.5) * 60;

    const sessionNode: GraphNode = {
      id: sessionNodeId,
      type: "inactive-session",
      x: prevSession?.x ?? parentX + jitter(),
      y: prevSession?.y ?? parentY + jitter(),
      vx: prevSession?.vx ?? 0,
      vy: prevSession?.vy ?? 0,
      pinned: prevSession?.pinned ?? false,
      radius: INACTIVE_SESSION_RADIUS,
      coordinationId: session.coordinationId,
      label: session.firstUserTurnPreview
        ? session.firstUserTurnPreview.slice(0, 40)
        : session.sessionId.slice(0, 12),
      color,
      sessionId: session.sessionId,
      ...(session.firstUserTurnPreview !== null
        ? { firstPromptPreview: session.firstUserTurnPreview }
        : {}),
    };
    nodes.push(sessionNode);
    currentNodesById.set(sessionNodeId, sessionNode);
    edges.push({ source: tentacleNodeId, target: sessionNodeId });
  }

  // Update position cache
  const nextMap = new Map<string, GraphNode>();
  for (const n of nodes) {
    nextMap.set(n.id, n);
  }
  prevNodesRef.current = nextMap;

  return {
    nodes,
    edges,
    tentacleById: deckMap,
    sessionsByTentacleId,
    refresh,
    refreshDeckTentacles,
  };
};
