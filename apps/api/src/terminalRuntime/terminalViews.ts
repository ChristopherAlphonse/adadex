import type { TerminalSnapshot } from "@adadex/core";

import { DEFAULT_TERMINAL_INACTIVITY_THRESHOLD_MS, TERMINAL_ID_PREFIX } from "./constants";
import type { PersistedTerminal, TerminalLifecycleState, TerminalSession } from "./types";

export const isProcessAlive = (pid: number | undefined): pid is number => {
  if (!pid || !Number.isInteger(pid) || pid <= 0) return false;

  try {
    process.kill(pid, 0);

    return true;
  } catch {
    return false;
  }
};

export const lifecycleStateToAgentState = (
  lifecycleState: TerminalLifecycleState,
): TerminalSnapshot["state"] => {
  switch (lifecycleState) {
    case "stale":
      return "stale";
    case "exited":
      return "exited";
    case "stopped":
      return "stopped";
    default:
      return "live";
  }
};

export const allocateTerminalId = (
  terminals: ReadonlyMap<string, PersistedTerminal>,
  sessions: ReadonlyMap<string, TerminalSession>,
  hasWorktree: (terminalId: string) => boolean,
  hasTranscript: (terminalId: string) => boolean = () => false,
): string => {
  let candidateNumber = 1;

  while (candidateNumber < Number.MAX_SAFE_INTEGER) {
    const candidateId = `${TERMINAL_ID_PREFIX}${candidateNumber}`;

    if (
      terminals.has(candidateId) ||
      sessions.has(candidateId) ||
      hasWorktree(candidateId) ||
      hasTranscript(candidateId)
    ) {
      candidateNumber += 1;
      continue;
    }

    return candidateId;
  }

  throw new Error("Unable to allocate terminal id.");
};

export const allocateDefaultTerminalName = (
  terminals: ReadonlyMap<string, PersistedTerminal>,
): string => {
  const usedNumbers = new Set<number>();
  const pattern = /^Adadex Terminal (\d+)$/;

  for (const terminal of terminals.values()) {
    const match = pattern.exec(terminal.coordinationName);

    if (match) usedNumbers.add(Number(match[1]));
  }

  let n = 1;

  while (usedNumbers.has(n)) n += 1;

  return `Adadex Terminal ${n}`;
};

export const isTerminalRecentlyActive = (
  terminal: PersistedTerminal,
  inactivityThresholdMs: number | undefined,
): boolean => {
  if (!terminal.lastActiveAt) return false;

  const thresholdMs = inactivityThresholdMs ?? DEFAULT_TERMINAL_INACTIVITY_THRESHOLD_MS;

  return Date.now() - new Date(terminal.lastActiveAt).getTime() < thresholdMs;
};

export const toTerminalSnapshot = (
  terminal: PersistedTerminal,
  session: TerminalSession | undefined,
  inactivityThresholdMs: number | undefined,
): TerminalSnapshot => {
  const lifecycleState: TerminalLifecycleState = session
    ? "running"
    : (terminal.lifecycleState ?? "registered");

  const snapshot: TerminalSnapshot = {
    terminalId: terminal.terminalId,
    label: terminal.terminalId,
    state: lifecycleStateToAgentState(lifecycleState),
    coordinationId: terminal.coordinationId,
    coordinationName: terminal.coordinationName,
    workspaceMode: terminal.workspaceMode,
    createdAt: terminal.createdAt,
    hasUserPrompt: isTerminalRecentlyActive(terminal, inactivityThresholdMs),
    lifecycleState,
  };

  if (terminal.parentTerminalId) {
    snapshot.parentTerminalId = terminal.parentTerminalId;
  }

  if (session) {
    snapshot.agentRuntimeState = session.agentState;
  }

  if (terminal.agentModel) {
    snapshot.agentModel = terminal.agentModel;
  }

  if (terminal.agentEffort) {
    snapshot.agentEffort = terminal.agentEffort;
  }

  if (terminal.lifecycleReason) {
    snapshot.lifecycleReason = terminal.lifecycleReason;
  }

  if (terminal.lifecycleUpdatedAt) {
    snapshot.lifecycleUpdatedAt = terminal.lifecycleUpdatedAt;
  }

  if (terminal.processId) {
    snapshot.processId = terminal.processId;
  }

  if (terminal.startedAt) {
    snapshot.startedAt = terminal.startedAt;
  }

  if (terminal.endedAt) {
    snapshot.endedAt = terminal.endedAt;
  }

  if (terminal.exitCode !== undefined) {
    snapshot.exitCode = terminal.exitCode;
  }

  if (terminal.exitSignal !== undefined) {
    snapshot.exitSignal = terminal.exitSignal;
  }

  return snapshot;
};

export const collectTerminalCascade = (
  rootTerminalId: string,
  terminals: ReadonlyMap<string, PersistedTerminal>,
): string[] => {
  const toDelete = new Set<string>();
  const queue = [rootTerminalId];

  while (queue.length > 0) {
    const currentTerminalId = queue.shift();

    if (!currentTerminalId || toDelete.has(currentTerminalId)) continue;

    toDelete.add(currentTerminalId);

    for (const terminal of terminals.values()) {
      if (terminal.parentTerminalId === currentTerminalId) {
        queue.push(terminal.terminalId);
      }
    }
  }

  return Array.from(toDelete);
};
