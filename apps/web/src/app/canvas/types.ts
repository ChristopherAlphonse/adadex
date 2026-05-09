import type {
  AgentRuntimeState,
  AgentState,
  CoordinationWorkspaceMode,
  DeckMascotAppearance,
} from "@adadex/core";

export type GraphNode = {
  id: string;
  type: "orchestration" | "deck-lead" | "active-session" | "inactive-session";
  x: number;
  y: number;
  vx: number;
  vy: number;
  pinned: boolean;
  radius: number;
  coordinationId: string;
  label: string;
  color: string;
  sessionId?: string;
  agentState?: AgentState;
  agentRuntimeState?: AgentRuntimeState;
  waitingToolName?: string;
  hasUserPrompt?: boolean;
  workspaceMode?: CoordinationWorkspaceMode;
  parentTerminalId?: string;
  firstPromptPreview?: string;
  mascot?: DeckMascotAppearance;
};

export type GraphEdge = {
  source: string;
  target: string;
};
