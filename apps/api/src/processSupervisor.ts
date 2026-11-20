import {
  asRecord,
  isNumber,
  isObjectValue,
  isString,
  type ParsedValue,
} from "@adadex/core";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import { writeTextFileAtomic } from "./atomicJsonFile";

export const PROCESS_REGISTRY_VERSION = 1 as const;

export type SupervisedProcess = {
  processId: number;
  processGroupId: number;
  sessionId: string;
  coordinationId: string;
  startedAt: string;
};

export type ProcessRegistryDocument = {
  version: typeof PROCESS_REGISTRY_VERSION;
  processes: SupervisedProcess[];
};

type ReapOrphansResult = { killed: string[]; dropped: string[] };

export type SupervisorDependencies = {
  clock: () => Date;
  load: () => ProcessRegistryDocument;
  save: (document: ProcessRegistryDocument) => void;
  isAlive: (processId: number) => boolean;
  readStartedAt: (processId: number) => string | null;
  signalGroup: (processGroupId: number, signal: NodeJS.Signals) => void;
};

const START_TIME_TOLERANCE_MS = 2_000;

/**
 * node-pty puts each PTY child in a new session with pgid === pid, so its
 * descendants can be signalled together with kill(-pgid, signal).
 */
export const signalProcessGroup = (processGroupId: number, signal: NodeJS.Signals): void => {
  // ConPTY closes the process handle on kill, which already terminates the
  // console process tree. Negative pids are not process groups on Windows.
  if (process.platform === "win32") {
    return;
  }

  process.kill(-processGroupId, signal);
};

export const isProcessAlive = (processId: number): boolean => {
  if (!Number.isInteger(processId) || processId <= 0) {
    return false;
  }

  try {
    process.kill(processId, 0);

    return true;
  } catch {
    return false;
  }
};

/** Returns the process start time in UTC, or null when it cannot be verified. */
export const readProcessStartedAt = (processId: number): string | null => {
  if (process.platform === "win32" || !Number.isInteger(processId) || processId <= 0) {
    return null;
  }

  try {
    const output = execFileSync("ps", ["-p", String(processId), "-o", "lstart="], {
      encoding: "utf8",
    }).trim();

    if (!output) {
      return null;
    }

    const timestamp = Date.parse(output);

    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
  } catch {
    return null;
  }
};

const isSupervisedProcess = (value: unknown): value is SupervisedProcess => {
  if (value === null || !isObjectValue(value) || Array.isArray(value)) {
    return false;
  }

  const record = asRecord(value);

  if (record === null) {
    return false;
  }

  return (
    isNumber(record.processId) &&
    Number.isInteger(record.processId) &&
    record.processId > 0 &&
    isNumber(record.processGroupId) &&
    Number.isInteger(record.processGroupId) &&
    record.processGroupId > 0 &&
    isString(record.sessionId) &&
    isString(record.coordinationId) &&
    isString(record.startedAt)
  );
};

export const loadProcessRegistry = (registryPath: string): ProcessRegistryDocument => {
  const empty: ProcessRegistryDocument = { version: PROCESS_REGISTRY_VERSION, processes: [] };

  if (!existsSync(registryPath)) {
    return empty;
  }

  try {
    // SAFETY: JSON.parse only yields JSON scalars, arrays, or plain objects.
    const parsed = JSON.parse(readFileSync(registryPath, "utf8")) as ParsedValue;
    const document = asRecord(parsed);

    if (
      document === null ||
      document.version !== PROCESS_REGISTRY_VERSION ||
      !Array.isArray(document.processes)
    ) {
      return empty;
    }

    return {
      version: PROCESS_REGISTRY_VERSION,
      processes: document.processes.filter(isSupervisedProcess),
    };
  } catch {
    return empty;
  }
};

export const persistProcessRegistry = (
  registryPath: string,
  document: ProcessRegistryDocument,
): void => {
  writeTextFileAtomic(registryPath, `${JSON.stringify(document, null, 2)}\n`);
};

export const createProcessSupervisor = (dependencies: SupervisorDependencies) => {
  const processes = new Map<string, SupervisedProcess>();

  for (const record of dependencies.load().processes) {
    processes.set(record.sessionId, record);
  }

  const save = () => {
    dependencies.save({
      version: PROCESS_REGISTRY_VERSION,
      processes: [...processes.values()],
    });
  };

  const isStillOurProcess = (record: SupervisedProcess): boolean => {
    if (!dependencies.isAlive(record.processId)) {
      return false;
    }

    const observedStart = dependencies.readStartedAt(record.processId);

    if (!observedStart) {
      return false;
    }

    const recorded = Date.parse(record.startedAt);
    const observed = Date.parse(observedStart);

    if (!Number.isFinite(recorded) || !Number.isFinite(observed)) {
      return false;
    }

    return Math.abs(recorded - observed) <= START_TIME_TOLERANCE_MS;
  };

  const terminateGroup = (record: SupervisedProcess, signal: NodeJS.Signals): boolean => {
    try {
      dependencies.signalGroup(record.processGroupId, signal);

      return true;
    } catch {
      return false;
    }
  };

  return {
    register(input: Omit<SupervisedProcess, "startedAt">): void {
      processes.set(input.sessionId, {
        ...input,
        startedAt: dependencies.clock().toISOString(),
      });
      save();
    },

    unregister(sessionId: string): void {
      if (processes.delete(sessionId)) {
        save();
      }
    },

    killAll(signal: NodeJS.Signals = "SIGKILL"): void {
      if (processes.size === 0) {
        return;
      }

      for (const record of processes.values()) {
        terminateGroup(record, signal);
      }

      processes.clear();
      save();
    },

    reapOrphansOnLaunch(signal: NodeJS.Signals = "SIGKILL"): ReapOrphansResult {
      const killed: string[] = [];
      const dropped: string[] = [];

      for (const [sessionId, record] of processes) {
        if (isStillOurProcess(record)) {
          if (terminateGroup(record, signal)) {
            killed.push(sessionId);
          }
        } else {
          // A recycled pid must never be signalled just because it is live.
          dropped.push(sessionId);
        }

        processes.delete(sessionId);
      }

      if (killed.length > 0 || dropped.length > 0) {
        save();
      }

      return { killed, dropped };
    },

    list(): SupervisedProcess[] {
      return [...processes.values()];
    },
  };
};
