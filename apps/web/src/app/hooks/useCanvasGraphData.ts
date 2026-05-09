import { useCallback, useEffect, useRef, useState } from "react";

import type { DeckCoordinationSummary } from "@adadex/core";
import { buildConversationsUrl, buildDeckOrchestrationsUrl } from "../../runtime/runtimeEndpoints";
import type { GraphEdge, GraphNode } from "../canvas/types";
import { normalizeConversationSessionSummary } from "../conversationNormalizers";
import type { ConversationSessionSummary, TerminalView } from "../types";
import type { AgentRuntimeStateInfo } from "./useAgentRuntimeStates";

const ORCHESTRATION_NODE_RADIUS = 40;
const ACTIVE_SESSION_RADIUS = 12;
const INACTIVE_SESSION_RADIUS = 10;

const DECK_LEAD_RADIUS = 52;
/** Synthetic coordination id for the canvas hub terminal; prefer this for new sessions. */
export const DECK_LEAD_ID = "__deck_lead__";
/** Legacy id from pre-rebrand builds; still accepted for persisted terminals and graph restore. */
const LEGACY_DECK_LEAD_ID = "__octoboss__";
const DECK_LEAD_NODE_ID = `t:${DECK_LEAD_ID}`;
const LEGACY_DECK_LEAD_NODE_ID = `t:${LEGACY_DECK_LEAD_ID}`;

const isDeckLeadCoordinationId = (id: string): boolean =>
  id === DECK_LEAD_ID || id === LEGACY_DECK_LEAD_ID;

const getAccentPrimary = (): string =>
  (typeof document !== "undefined"
    ? getComputedStyle(document.documentElement).getPropertyValue("--accent-primary").trim()
    : "") || "#a3e635";

// Must match the Deck tab's MASCOT_COLORS for consistent coordination colors
const MASCOT_COLORS = [
  "#a3e635",
  "#eab308",
  "#84cc16",
  "#d9f99d",
];

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const orchestrationColor = (coordinationId: string, deckColor: string | null | undefined) =>
  deckColor && deckColor.length > 0
    ? deckColor
    : (MASCOT_COLORS[hashString(coordinationId) % MASCOT_COLORS.length] as string);

type UseCanvasGraphDataOptions = {
  columns: TerminalView;
  enabled: boolean;
  agentRuntimeStates?: Map<string, AgentRuntimeStateInfo>;
};

type UseCanvasGraphDataResult = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  orchestrationById: ReadonlyMap<string, DeckCoordinationSummary>;
  sessionsByOrchestrationId: ReadonlyMap<string, ConversationSessionSummary[]>;
  refresh: () => Promise<void>;
  refreshDeckOrchestrations: () => Promise<void>;
};

const buildOrchestrationNodeId = (coordinationId: string) => `t:${coordinationId}`;
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
  const appearanceRecord =
    record.mascot !== null && typeof record.mascot === "object"
      ? (record.mascot as Record<string, unknown>)
      : record.octopus !== null && typeof record.octopus === "object"
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
    mascot: {
      animation:
        typeof appearanceRecord?.animation === "string" ? appearanceRecord.animation : null,
      expression:
        typeof appearanceRecord?.expression === "string" ? appearanceRecord.expression : null,
      accessory:
        typeof appearanceRecord?.accessory === "string" ? appearanceRecord.accessory : null,
      hairColor:
        typeof appearanceRecord?.hairColor === "string" ? appearanceRecord.hairColor : null,
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
  const [deckOrchestrations, setDeckOrchestrations] = useState<DeckCoordinationSummary[]>([]);
  const [inactiveSessions, setInactiveSessions] = useState<ConversationSessionSummary[]>([]);
  const prevNodesRef = useRef<Map<string, GraphNode>>(new Map());

  const fetchDeckOrchestrations = useCallback(async () => {
    try {
      const response = await fetch(buildDeckOrchestrationsUrl(), {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return;
      const payload = (await response.json()) as unknown;
      if (!Array.isArray(payload)) return;
      const items = payload
        .map((entry) => normalizeDeckCoordinationSummary(entry))
        .filter((entry): entry is DeckCoordinationSummary => entry !== null);
      setDeckOrchestrations(items);
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
      setDeckOrchestrations([]);
      setInactiveSessions([]);
      return;
    }
    void fetchDeckOrchestrations();
    void fetchInactiveSessions();
  }, [enabled, fetchDeckOrchestrations, fetchInactiveSessions]);

  const refresh = useCallback(async () => {
    await Promise.all([fetchDeckOrchestrations(), fetchInactiveSessions()]);
  }, [fetchDeckOrchestrations, fetchInactiveSessions]);
  const refreshDeckOrchestrations = useCallback(async () => {
    await fetchDeckOrchestrations();
  }, [fetchDeckOrchestrations]);

  const activeTerminalIds = new Set(columns.map((terminal) => terminal.terminalId));

  // Build a map of deck orchestrations for color/label lookup
  const deckMap = new Map<string, DeckCoordinationSummary>();
  for (const dt of deckOrchestrations) {
    deckMap.set(dt.coordinationId, dt);
  }

  const sessionsByOrchestrationId = new Map<string, ConversationSessionSummary[]>();
  for (const session of inactiveSessions) {
    if (!session.coordinationId) {
      continue;
    }
    const orchestrationSessions = sessionsByOrchestrationId.get(session.coordinationId);
    if (orchestrationSessions) {
      orchestrationSessions.push(session);
    } else {
      sessionsByOrchestrationId.set(session.coordinationId, [session]);
    }
  }

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const prevNodes = prevNodesRef.current;
  const currentNodesById = new Map<string, GraphNode>();
  const seenOrchestrationIds = new Set<string>();

  // Build a map of active terminals by coordinationId (multiple terminals can share a orchestration)
  const activeTerminalsByOrchestration = new Map<string, TerminalView>();
  for (const terminal of columns) {
    const group = activeTerminalsByOrchestration.get(terminal.coordinationId);
    if (group) {
      group.push(terminal);
    } else {
      activeTerminalsByOrchestration.set(terminal.coordinationId, [terminal]);
    }
  }

  // Build orchestration list: only deck orchestrations (sandbox and other non-deck
  // terminals are excluded from the graph).
  const allOrchestrationIds: string[] = [];
  for (const dt of deckOrchestrations) {
    allOrchestrationIds.push(dt.coordinationId);
    seenOrchestrationIds.add(dt.coordinationId);
  }

  const totalOrchestrations = allOrchestrationIds.length;

  for (let i = 0; i < allOrchestrationIds.length; i++) {
    const coordinationId = allOrchestrationIds[i];
    if (!coordinationId) continue;
    const orchestrationNodeId = buildOrchestrationNodeId(coordinationId);
    const prev = prevNodes.get(orchestrationNodeId);
    const deck = deckMap.get(coordinationId);
    const activeTerminals = activeTerminalsByOrchestration.get(coordinationId);
    const firstActiveTerminal = activeTerminals?.[0];
    const color = orchestrationColor(coordinationId, deck?.color);
    const label = deck?.displayName ?? firstActiveTerminal?.coordinationName ?? coordinationId;

    const angle = (2 * Math.PI * i) / Math.max(totalOrchestrations, 1);
    const spread = 300;

    const node: GraphNode = {
      id: orchestrationNodeId,
      type: "orchestration",
      x: prev?.x ?? Math.cos(angle) * spread,
      y: prev?.y ?? Math.sin(angle) * spread,
      vx: prev?.vx ?? 0,
      vy: prev?.vy ?? 0,
      pinned: prev?.pinned ?? false,
      radius: ORCHESTRATION_NODE_RADIUS,
      coordinationId,
      label,
      color,
      ...(firstActiveTerminal ? { workspaceMode: firstActiveTerminal.workspaceMode } : {}),
      ...(deck?.mascot ? { mascot: deck.mascot } : {}),
    };
    nodes.push(node);
    currentNodesById.set(orchestrationNodeId, node);

    // Active terminal session nodes — one per terminal in this orchestration
    if (activeTerminals) {
      for (const activeTerminal of activeTerminals) {
        const sessionNodeId = buildActiveSessionNodeId(activeTerminal.terminalId);
        const prevSession = prevNodes.get(sessionNodeId);
        const parentNodeId = activeTerminal.parentTerminalId
          ? buildActiveSessionNodeId(activeTerminal.parentTerminalId)
          : orchestrationNodeId;
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

  // Deck lead — synthetic always-present hub node
  const prevBoss =
    prevNodes.get(DECK_LEAD_NODE_ID) ?? prevNodes.get(LEGACY_DECK_LEAD_NODE_ID) ?? null;
  const deckLeadColor = getAccentPrimary();
  const deckLeadNode: GraphNode = {
    id: DECK_LEAD_NODE_ID,
    type: "deck-lead",
    x: prevBoss?.x ?? 0,
    y: prevBoss?.y ?? 0,
    vx: prevBoss?.vx ?? 0,
    vy: prevBoss?.vy ?? 0,
    pinned: prevBoss?.pinned ?? false,
    radius: DECK_LEAD_RADIUS,
    coordinationId: DECK_LEAD_ID,
    label: "Deck lead",
    color: deckLeadColor,
  };
  nodes.push(deckLeadNode);
  currentNodesById.set(DECK_LEAD_NODE_ID, deckLeadNode);

  // Connect deck lead to every coordination node
  for (const coordinationId of allOrchestrationIds) {
    edges.push({ source: DECK_LEAD_NODE_ID, target: buildOrchestrationNodeId(coordinationId) });
  }

  // Link active terminals belonging to the deck lead hub
  for (const terminal of columns) {
    if (!isDeckLeadCoordinationId(terminal.coordinationId)) continue;
    const sessionNodeId = buildActiveSessionNodeId(terminal.terminalId);
    const prevSession = prevNodes.get(sessionNodeId);
    const jitter = () => (Math.random() - 0.5) * 60;

    const bossRuntimeInfo = agentRuntimeStates?.get(terminal.terminalId);
    const sessionNode: GraphNode = {
      id: sessionNodeId,
      type: "active-session",
      x: prevSession?.x ?? deckLeadNode.x + jitter(),
      y: prevSession?.y ?? deckLeadNode.y + jitter(),
      vx: prevSession?.vx ?? 0,
      vy: prevSession?.vy ?? 0,
      pinned: prevSession?.pinned ?? false,
      radius: ACTIVE_SESSION_RADIUS,
      coordinationId: terminal.coordinationId,
      label: terminal.coordinationName || terminal.terminalId,
      color: deckLeadColor,
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
    edges.push({ source: DECK_LEAD_NODE_ID, target: sessionNodeId });
  }

  // Inactive sessions from conversations
  for (const session of inactiveSessions) {
    if (!session.coordinationId || !seenOrchestrationIds.has(session.coordinationId)) continue;
    if (activeTerminalIds.has(session.sessionId)) continue;

    const orchestrationNodeId = buildOrchestrationNodeId(session.coordinationId);
    const sessionNodeId = buildInactiveSessionNodeId(session.sessionId);
    const prevSession = prevNodes.get(sessionNodeId);

    const parentNode = nodes.find((n) => n.id === orchestrationNodeId);
    const parentX = parentNode?.x ?? 0;
    const parentY = parentNode?.y ?? 0;
    const color = orchestrationColor(session.coordinationId, deckMap.get(session.coordinationId)?.color);
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
    edges.push({ source: orchestrationNodeId, target: sessionNodeId });
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
    orchestrationById: deckMap,
    sessionsByOrchestrationId,
    refresh,
    refreshDeckOrchestrations,
  };
};
