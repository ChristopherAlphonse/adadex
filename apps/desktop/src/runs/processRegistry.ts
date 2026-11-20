import { randomUUID } from "node:crypto";
import type { HostProcess, ProcessPort } from "../ipc/contract";

export interface ProcessHandle {
  readonly processId: string;
  /** Call when the process has ended, however it ended. */
  done(): void;
}

export interface ProcessRegistry extends ProcessPort {
  /** Record a process the app started, with the function that stops it. */
  register(label: string, kill: () => void): ProcessHandle;
  /** Stop everything still running. Used when the app quits. */
  killAll(): void;
}

interface Entry {
  readonly info: HostProcess;
  readonly kill: () => void;
  ended: string | undefined;
}

const KEEP_ENDED = 20;

/**
 * Every process the app starts (agents, the project's checks) is listed here with when it started, so a person
 * can see what is running and stop it. Finished ones stay in the list for a while so a run is not a mystery.
 */
export const createProcessRegistry = (
  now: () => Date = () => new Date(),
  newId: () => string = randomUUID,
  onEvent: (event: "start" | "end" | "kill", info: HostProcess) => void = () => {},
): ProcessRegistry => {
  const entries = new Map<string, Entry>();

  const trim = (): void => {
    const ended = [...entries.values()].filter((e) => e.ended !== undefined);
    for (const e of ended.slice(0, Math.max(0, ended.length - KEEP_ENDED)))
      entries.delete(e.info.processId);
  };

  const view = (e: Entry): HostProcess => ({
    ...e.info,
    ...(e.ended === undefined ? {} : { endedAt: e.ended }),
  });

  return {
    register(label, kill) {
      const processId = newId();
      const entry: Entry = {
        info: { processId, label, startedAt: now().toISOString() },
        kill,
        ended: undefined,
      };
      entries.set(processId, entry);
      onEvent("start", entry.info);
      return {
        processId,
        done: () => {
          if (entry.ended === undefined) onEvent("end", view(entry));
          entry.ended ??= now().toISOString();
          trim();
        },
      };
    },
    async list() {
      return [...entries.values()].map(view);
    },
    async kill(processId) {
      const entry = entries.get(processId);
      if (!entry) throw new Error("no such process");
      if (entry.ended !== undefined) throw new Error("that process has already ended");
      onEvent("kill", entry.info);
      entry.kill();
    },
    killAll() {
      for (const e of entries.values()) {
        if (e.ended === undefined) e.kill();
      }
    },
  };
};
