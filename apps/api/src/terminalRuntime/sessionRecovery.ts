import type { PersistedTerminal } from "./types";

export const SESSION_RESTART_REASON = "restart_pending";

export type SessionRecoveryResult = {
  recoveredTerminalIds: string[];
  orphanedTerminalIds: string[];
};

/**
 * A PTY cannot survive an app restart, but its terminal record keeps the prompt
 * and provider needed to launch it again. Interrupted sessions become resumable
 * instead of stale; only a process that is still alive is left stale because it
 * was not reaped and restarting it would create a duplicate agent.
 */
export const recoverPersistedSessions = ({
  terminals,
  now,
  isProcessAlive,
}: {
  terminals: Map<string, PersistedTerminal>;
  now: string;
  isProcessAlive: (processId: number | undefined) => boolean;
}): SessionRecoveryResult => {
  const recoveredTerminalIds: string[] = [];
  const orphanedTerminalIds: string[] = [];

  for (const terminal of terminals.values()) {
    if (terminal.lifecycleState !== "running") {
      continue;
    }

    terminal.lifecycleUpdatedAt = now;

    if (isProcessAlive(terminal.processId)) {
      terminal.lifecycleState = "stale";
      terminal.lifecycleReason = "orphaned_process";
      orphanedTerminalIds.push(terminal.terminalId);
      continue;
    }

    terminal.lifecycleState = "stopped";
    terminal.lifecycleReason = SESSION_RESTART_REASON;
    terminal.processId = undefined;
    terminal.startedAt = undefined;
    terminal.endedAt = undefined;
    terminal.exitCode = undefined;
    terminal.exitSignal = undefined;
    recoveredTerminalIds.push(terminal.terminalId);
  }

  return { recoveredTerminalIds, orphanedTerminalIds };
};
