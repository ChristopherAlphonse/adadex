import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createProcessSupervisor,
  loadProcessRegistry,
  type ProcessRegistryDocument,
  persistProcessRegistry,
  type SupervisedProcess,
  type SupervisorDependencies,
} from "../src/processSupervisor";

const RECORDED_START = "2026-11-19T10:00:00.000Z";

const makeRecord = (overrides: Partial<SupervisedProcess> = {}): SupervisedProcess => ({
  processId: 4100,
  processGroupId: 4100,
  sessionId: "terminal-1",
  coordinationId: "orchestration-1",
  startedAt: RECORDED_START,
  ...overrides,
});

const makeDeps = (
  records: SupervisedProcess[],
  overrides: Partial<SupervisorDependencies> = {},
): SupervisorDependencies => ({
  clock: () => new Date("2026-11-19T12:00:00.000Z"),
  load: () => ({ version: 1, processes: records }) satisfies ProcessRegistryDocument,
  save: vi.fn(),
  isAlive: vi.fn(() => true),
  readStartedAt: vi.fn(() => RECORDED_START),
  signalGroup: vi.fn(),
  ...overrides,
});

describe("createProcessSupervisor", () => {
  it("signals the process group of every recorded session on quit", () => {
    const deps = makeDeps([
      makeRecord(),
      makeRecord({ processId: 4200, processGroupId: 4200, sessionId: "terminal-2" }),
    ]);
    const supervisor = createProcessSupervisor(deps);

    supervisor.killAll();

    expect(deps.signalGroup).toHaveBeenCalledWith(4100, "SIGKILL");
    expect(deps.signalGroup).toHaveBeenCalledWith(4200, "SIGKILL");
    expect(deps.save).toHaveBeenCalledWith({ version: 1, processes: [] });
  });

  it("keeps killing other groups when one is already gone", () => {
    const signalGroup = vi.fn((group: number) => {
      if (group === 4100) {
        throw new Error("ESRCH");
      }
    });
    const deps = makeDeps(
      [
        makeRecord(),
        makeRecord({ processId: 4200, processGroupId: 4200, sessionId: "terminal-2" }),
      ],
      { signalGroup },
    );
    const supervisor = createProcessSupervisor(deps);

    supervisor.killAll();

    expect(signalGroup).toHaveBeenCalledWith(4200, "SIGKILL");
  });

  it("reaps a live orphan group whose recorded start time still matches", () => {
    const deps = makeDeps([makeRecord()]);
    const supervisor = createProcessSupervisor(deps);

    const result = supervisor.reapOrphansOnLaunch();

    expect(deps.signalGroup).toHaveBeenCalledWith(4100, "SIGKILL");
    expect(result.killed).toEqual(["terminal-1"]);
    expect(deps.save).toHaveBeenCalledWith({ version: 1, processes: [] });
  });

  it("does not signal a recycled pid whose start time changed", () => {
    const deps = makeDeps([makeRecord()], {
      readStartedAt: vi.fn(() => "2026-11-19T11:30:00.000Z"),
    });
    const supervisor = createProcessSupervisor(deps);

    const result = supervisor.reapOrphansOnLaunch();

    expect(deps.signalGroup).not.toHaveBeenCalled();
    expect(result.killed).toEqual([]);
    expect(result.dropped).toEqual(["terminal-1"]);
    expect(deps.save).toHaveBeenCalledWith({ version: 1, processes: [] });
  });

  it("drops dead processes without signalling them", () => {
    const deps = makeDeps([makeRecord()], { isAlive: vi.fn(() => false) });
    const supervisor = createProcessSupervisor(deps);

    const result = supervisor.reapOrphansOnLaunch();

    expect(deps.signalGroup).not.toHaveBeenCalled();
    expect(result.dropped).toEqual(["terminal-1"]);
  });

  it("drops records whose process start time cannot be verified", () => {
    const deps = makeDeps([makeRecord()], { readStartedAt: vi.fn(() => null) });
    const supervisor = createProcessSupervisor(deps);

    const result = supervisor.reapOrphansOnLaunch();

    expect(deps.signalGroup).not.toHaveBeenCalled();
    expect(result.dropped).toEqual(["terminal-1"]);
  });

  it("records the clock's start time when a session is registered", () => {
    const deps = makeDeps([]);
    const supervisor = createProcessSupervisor(deps);

    supervisor.register({
      processId: 4100,
      processGroupId: 4100,
      sessionId: "terminal-1",
      coordinationId: "orchestration-1",
    });

    expect(deps.save).toHaveBeenCalledWith({
      version: 1,
      processes: [makeRecord({ startedAt: "2026-11-19T12:00:00.000Z" })],
    });
  });

  it("unregisters only the matching session", () => {
    const deps = makeDeps([
      makeRecord(),
      makeRecord({ processId: 4200, processGroupId: 4200, sessionId: "terminal-2" }),
    ]);
    const supervisor = createProcessSupervisor(deps);

    supervisor.unregister("terminal-1");

    expect(deps.save).toHaveBeenCalledWith({
      version: 1,
      processes: [makeRecord({ processId: 4200, processGroupId: 4200, sessionId: "terminal-2" })],
    });
  });
});

describe("process registry files", () => {
  const directories: string[] = [];

  const createTemporaryDirectory = () => {
    const directory = mkdtempSync(join(tmpdir(), "adadex-process-registry-test-"));
    directories.push(directory);
    return directory;
  };

  afterEach(() => {
    for (const directory of directories) {
      rmSync(directory, { recursive: true, force: true });
    }
    directories.length = 0;
  });

  it("round-trips supervised processes through an atomic write", () => {
    const path = join(createTemporaryDirectory(), "state", "processes.json");
    const document: ProcessRegistryDocument = { version: 1, processes: [makeRecord()] };

    persistProcessRegistry(path, document);

    expect(loadProcessRegistry(path)).toEqual(document);
    expect(readFileSync(path, "utf8").endsWith("\n")).toBe(true);
  });

  it("returns an empty registry when the file is corrupt", () => {
    const path = join(createTemporaryDirectory(), "processes.json");
    writeFileSync(path, "{not json", "utf8");

    expect(loadProcessRegistry(path)).toEqual({ version: 1, processes: [] });
  });

  it("drops malformed process records while keeping valid ones", () => {
    const path = join(createTemporaryDirectory(), "processes.json");
    writeFileSync(
      path,
      JSON.stringify({
        version: 1,
        processes: [makeRecord(), { sessionId: "terminal-broken" }],
      }),
      "utf8",
    );

    expect(loadProcessRegistry(path)).toEqual({ version: 1, processes: [makeRecord()] });
  });
});
