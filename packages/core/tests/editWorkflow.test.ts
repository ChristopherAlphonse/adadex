import { describe, expect, it } from "vitest";

import { advanceJob } from "../src/application/advanceJob";
import {
  addMove,
  addStage,
  type EditResult,
  newWorkflow,
  problemsOf,
  removeMove,
  removeStage,
  renameStage,
  setConditions,
  setEffects,
  setHint,
  setInitial,
  setSkills,
  setTerminal,
} from "../src/application/editWorkflow";
import { parseWorkflow } from "../src/application/parseWorkflow";
import { newJob, type WorkflowDefinition } from "../src/domain/workflow";
import { factoryBuildPreset } from "../src/presets";

const ok = (r: EditResult): WorkflowDefinition => {
  if (!r.ok) throw new Error(r.error);

  return r.workflow;
};

describe("building a workflow from nothing, one edit at a time", () => {
  it("starts with a valid one-stage shell that a person can grow", () => {
    const w = newWorkflow("my-flow", "My flow");
    expect(w.origin).toBe("user");
    expect(w.stages.map((s) => s.id)).toEqual(["start", "done"]);
    expect(problemsOf(w)).toEqual([]);
  });

  it("grows into a working three-stage workflow that the engine can run", () => {
    let w = newWorkflow("my-flow", "My flow");
    w = ok(addStage(w, "review", "check it"));
    w = ok(removeMove(w, "start", "done"));
    w = ok(addMove(w, "start", "review"));
    w = ok(addMove(w, "review", "done"));
    w = ok(
      setConditions(w, "start", "review", [
        { kind: "doc-field", doc: "draft.md", field: "STATUS", equals: "READY" },
      ]),
    );
    w = ok(setSkills(w, "start", [{ name: "my-writer", role: "writer" }]));
    expect(problemsOf(w)).toEqual([]);
    const parsed = parseWorkflow(JSON.parse(JSON.stringify(w)));
    expect(parsed.ok).toBe(true);
    const job = newJob(w, "j1", "t", { roundLimit: 3 });

    const moved = advanceJob(w, job, "review", {
      docs: { "draft.md": { STATUS: "READY" } },
      reviews: {},
    });

    expect(moved.ok && moved.job.stage).toBe("review");
  });
});

describe("edits", () => {
  const base = () => newWorkflow("w", "W");

  it("refuses a bad or duplicate stage id and the reserved one", () => {
    expect(addStage(base(), "Bad Id", "x")).toEqual({
      ok: false,
      error: "stage id must match [a-z0-9][a-z0-9-]*",
    });
    expect(addStage(base(), "start", "x")).toEqual({
      ok: false,
      error: "stage start already exists",
    });
    expect(addStage(base(), "needs-human", "x")).toEqual({
      ok: false,
      error: "needs-human is reserved and cannot be a stage",
    });
  });

  it("removes a stage and every move that pointed to it, but never the start", () => {
    let w = ok(addStage(base(), "mid", "x"));
    w = ok(addMove(w, "start", "mid"));
    w = ok(removeStage(w, "mid"));
    expect(w.stages.some((s) => s.id === "mid")).toBe(false);
    expect(w.stages.find((s) => s.id === "start")?.moves.map((m) => m.to)).toEqual(["done"]);
    expect(removeStage(w, "start")).toEqual({
      ok: false,
      error: "the start stage cannot be removed; make another stage the start first",
    });
    expect(removeStage(w, "nope").ok).toBe(false);
  });

  it("renames a stage everywhere it appears, including the start", () => {
    const w = ok(renameStage(base(), "start", "draft"));
    expect(w.initial).toBe("draft");
    expect(w.stages.map((s) => s.id)).toEqual(["draft", "done"]);
    expect(renameStage(w, "draft", "done")).toEqual({
      ok: false,
      error: "stage done already exists",
    });
    const moved = ok(renameStage(w, "done", "finished"));
    expect(moved.stages.find((s) => s.id === "draft")?.moves[0]?.to).toBe("finished");
  });

  it("wires and unwires moves, refuses a duplicate or a move out of a terminal stage, and allows parking", () => {
    let w = ok(addStage(base(), "mid", "x"));
    expect(addMove(w, "start", "done")).toEqual({
      ok: false,
      error: "start already moves to done",
    });
    expect(addMove(w, "done", "mid")).toEqual({
      ok: false,
      error: "done is a terminal stage and cannot have moves",
    });
    expect(addMove(w, "start", "nowhere").ok).toBe(false);
    w = ok(addMove(w, "mid", "needs-human"));
    expect(w.stages.find((s) => s.id === "mid")?.moves.map((m) => m.to)).toEqual(["needs-human"]);
    expect(removeMove(w, "mid", "done").ok).toBe(false);
  });

  it("sets and clears conditions and effects on one move without touching the others", () => {
    let w = ok(addStage(base(), "mid", "x"));
    w = ok(addMove(w, "start", "mid"));
    w = ok(setConditions(w, "start", "mid", [{ kind: "committed" }]));
    w = ok(setEffects(w, "start", "mid", [{ kind: "bump-round" }]));
    const moves = w.stages.find((s) => s.id === "start")?.moves ?? [];
    expect(moves.find((m) => m.to === "mid")?.requires).toEqual([{ kind: "committed" }]);
    expect(moves.find((m) => m.to === "done")?.requires).toBeUndefined();
    w = ok(setConditions(w, "start", "mid", []));
    expect(
      w.stages.find((s) => s.id === "start")?.moves.find((m) => m.to === "mid")?.requires,
    ).toEqual([]);
    expect(setConditions(w, "start", "zzz", []).ok).toBe(false);
  });

  it("changes the hint, the start stage, and whether a stage is terminal", () => {
    let w = ok(setHint(base(), "start", "write the thing"));
    expect(w.stages[0]?.hint).toBe("write the thing");
    w = ok(addStage(w, "mid", "x"));
    w = ok(setInitial(w, "mid"));
    expect(w.initial).toBe("mid");
    expect(setInitial(w, "nope").ok).toBe(false);
    expect(setTerminal(w, "start", true)).toEqual({
      ok: false,
      error: "start has moves, so it cannot be terminal; remove them first",
    });
    w = ok(removeMove(w, "start", "done"));
    w = ok(setTerminal(w, "start", true));
    expect(w.stages.find((s) => s.id === "start")?.terminal).toBe(true);
  });

  it("does not change the workflow it was given", () => {
    const w = base();
    const before = JSON.stringify(w);
    addStage(w, "x", "y");
    renameStage(w, "start", "begin");
    expect(JSON.stringify(w)).toBe(before);
  });
});

describe("problemsOf", () => {
  it("reports what stops a half-drawn workflow from running, in words", () => {
    const w = ok(addStage(newWorkflow("w", "W"), "island", "x"));
    expect(problemsOf(w)).toContain("stage island has no moves and is not terminal");
    expect(problemsOf(w)).toContain("stage island cannot be reached from start");
  });

  it("finds a preset valid", () => {
    expect(problemsOf(factoryBuildPreset)).toEqual([]);
  });
});
