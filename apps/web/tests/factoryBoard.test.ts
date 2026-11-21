import { describe, expect, it } from "vitest";

import { buildFactoryBoard, formatElapsed } from "../src/app/factory/board";
import type { FactoryJob, FactoryWorkflow } from "../src/runtime/factoryHost";

const workflow: FactoryWorkflow = {
  id: "factory",
  name: "Factory",
  stages: [
    {
      id: "spec",
      title: "Specification",
      moves: [{ to: "build" }],
    },
    {
      id: "ship",
      title: "Ship",
      moves: [{ to: "ready" }],
    },
    { id: "ready", moves: [] },
  ],
};

const job = (overrides: Partial<FactoryJob> = {}): FactoryJob => ({
  id: "demo",
  title: "Demo",
  workflowId: "factory",
  stage: "ship",
  round: 1,
  roundLimit: 3,
  commit: null,
  ...overrides,
});

describe("factory board view model", () => {
  it("groups jobs by stage and keeps workflow order", () => {
    const board = buildFactoryBoard(
      [job({ id: "second", title: "Second", stage: "ready" }), job()],
      [workflow],
    );

    expect(board.columns.map((column) => column.id)).toEqual(["spec", "ship", "ready"]);
    expect(board.placedJobs).toBe(2);
    expect(board.columns[1]?.jobs.map((entry) => entry.job.id)).toEqual(["demo"]);
    expect(board.columns[2]?.jobs.map((entry) => entry.job.id)).toEqual(["second"]);
  });

  it("offers the human commit button and stage moves as host actions", () => {
    const board = buildFactoryBoard([job()], [workflow]);
    const actions = board.columns[1]?.jobs[0]?.actions ?? [];

    expect(actions[0]).toEqual({
      id: "job.commit_local",
      label: "Commit locally",
      input: { id: "demo" },
      isHuman: true,
    });
    expect(actions).toContainEqual({
      id: "job.advance",
      label: "Move to ready",
      input: { id: "demo", to: "ready" },
      isHuman: false,
    });
  });

  it("offers spec approval, unblock and gate actions where they belong", () => {
    const spec = buildFactoryBoard([job({ stage: "spec" })], [workflow]).columns[0]?.jobs[0];

    const parked = buildFactoryBoard(
      [job({ stage: "gate", parkedFrom: "build" })],
      [workflow],
    ).columns.find((column) => column.id === "gate")?.jobs[0];

    expect(spec?.actions.some((action) => action.id === "job.approve_spec")).toBe(true);
    expect(parked?.actions.some((action) => action.id === "job.unblock")).toBe(true);
    expect(parked?.actions.some((action) => action.id === "job.run_gate")).toBe(true);
  });

  it("formats elapsed process time", () => {
    const start = Date.parse("2026-11-19T12:00:00.000Z");
    expect(formatElapsed("2026-11-19T12:00:00.000Z", start + 5_000)).toBe("5s");
    expect(formatElapsed("2026-11-19T12:00:00.000Z", start + 125_000)).toBe("2m 5s");
    expect(formatElapsed("2026-11-19T12:00:00.000Z", start + 3_725_000)).toBe("1h 2m");
    expect(formatElapsed("not a date", start)).toBe("unknown");
  });
});
