import type { AgentRuntimeState } from "./agentRuntime";

export type AgentState = "live" | "idle" | "queued" | "blocked" | "stopped" | "exited" | "stale";

export type TerminalLifecycleState = "registered" | "running" | "stopped" | "exited" | "stale";

export type CoordinationWorkspaceMode = "shared" | "worktree";

export type TerminalSnapshot = {
  terminalId: string;
  label: string;
  state: AgentState;
  coordinationId: string;
  coordinationName?: string;
  workspaceMode?: CoordinationWorkspaceMode;
  createdAt: string;
  hasUserPrompt?: boolean;
  parentTerminalId?: string;
  agentRuntimeState?: AgentRuntimeState;
  /** Persisted launch flags for the agent CLI; applied when the session (re)starts. */
  agentModel?: string;
  agentEffort?: string;
  lifecycleState?: TerminalLifecycleState;
  lifecycleReason?: string;
  lifecycleUpdatedAt?: string;
  processId?: number;
  startedAt?: string;
  endedAt?: string;
  exitCode?: number;
  exitSignal?: number | string;
};
