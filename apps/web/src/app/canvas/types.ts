import type {
  AgentRuntimeState,
  AgentState,
  CoordinationWorkspaceMode,
  DeckOctopusAppearance,
} from "@adadex/core";

export type GraphNode = {
  id: string;
  type: "tentacle" | "octoboss" | "active-session" | "inactive-session";
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
  octopus?: DeckOctopusAppearance;
};

export type GraphEdge = {
  source: string;
  target: string;
};
