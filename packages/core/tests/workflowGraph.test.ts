import { describe, expect, it } from "vitest";

import { describeCondition, describeEffect, toGraph } from "../src/application/workflowGraph";
import { factoryBuildPreset, factoryReviewPreset } from "../src/presets";

describe("describeCondition / describeEffect", () => {
  it("says each condition and effect in plain words", () => {
    expect(
      describeCondition({ kind: "doc-field", doc: "shape.md", field: "STATUS", equals: "READY" }),
    ).toBe("shape.md has STATUS: READY");
    expect(
      describeCondition({ kind: "doc-field", doc: "x.md", field: "S", equals: ["A", "B"] }),
    ).toBe("x.md has S: A or B");
    expect(describeCondition({ kind: "doc-exists", doc: "spec.md" })).toBe("spec.md exists");
    expect(describeCondition({ kind: "gate-is", equals: "PASS" })).toBe("the gate is PASS");
    expect(describeCondition({ kind: "approved", what: "spec" })).toBe("you approved the spec");
    expect(describeCondition({ kind: "approval-current", what: "spec" })).toBe(
      "the spec is unchanged since you approved it",
    );
    expect(describeCondition({ kind: "committed" })).toBe("a local commit was made");
    expect(describeCondition({ kind: "flag", name: "polished", is: false })).toBe(
      "polished is off",
    );
    expect(describeCondition({ kind: "reviews-clean" })).toBe("no reviewer asked for changes");
    expect(
      describeCondition({ kind: "doc-field-number", doc: "report.md", field: "FINDINGS" }),
    ).toBe("report.md has a number in FINDINGS");
  });

  it("describes a condition the same way whatever error message it carries", () => {
    expect(describeCondition({ kind: "gate-run", message: "run it first" })).toBe(
      "the gate has been run",
    );
  });

  it("describes effects", () => {
    expect(describeEffect({ kind: "bump-round" })).toBe(
      "count a round, and park the job if rounds run out",
    );
    expect(describeEffect({ kind: "set-round", value: 1 })).toBe("set the round to 1");
    expect(describeEffect({ kind: "set-flag", name: "polished", value: true })).toBe(
      "turn polished on",
    );
    expect(describeEffect({ kind: "emit", name: "make-worktree" })).toBe("make the job's worktree");
  });
});

describe("toGraph", () => {
  const graph = toGraph(factoryBuildPreset);
  const node = (id: string) => graph.nodes.find((n) => n.id === id);
  const edge = (from: string, to: string) =>
    graph.edges.find((e) => e.from === from && e.to === to);

  it("has a node per stage and never draws needs-human as a node", () => {
    expect(graph.nodes.map((n) => n.id)).toEqual(factoryBuildPreset.stages.map((s) => s.id));
    expect(graph.nodes.some((n) => n.id === "needs-human")).toBe(false);
  });

  it("layers stages left to right from the start, and gives every node its own spot", () => {
    expect(node("shape")?.layer).toBe(0);
    expect(node("spec")?.layer).toBe(1);
    expect(node("build")?.layer).toBe(2);
    expect(node("gate")?.layer).toBe(3);
    const spots = graph.nodes.map((n) => `${n.x},${n.y}`);
    expect(new Set(spots).size).toBe(spots.length);
  });

  it("marks a move back to an earlier stage as a loop, and the rest as forward", () => {
    expect(edge("gate", "build")?.kind).toBe("back");
    expect(edge("review", "build")?.kind).toBe("back");
    expect(edge("polish", "gate")?.kind).toBe("back");
    expect(edge("shape", "spec")?.kind).toBe("forward");
    expect(edge("gate", "review")?.kind).toBe("forward");
  });

  it("shows a move to needs-human as a badge on the stage, not an edge", () => {
    expect(node("build")?.canPark).toBe(true);
    expect(node("shape")?.canPark).toBe(false);
    expect(graph.edges.some((e) => e.to === "needs-human")).toBe(false);
  });

  it("labels each edge with its conditions and effects in words", () => {
    const e = edge("spec", "build");
    expect(e?.requires).toEqual([
      "spec.md exists",
      "you approved the spec",
      "the spec is unchanged since you approved it",
    ]);
    expect(e?.effects).toEqual(["set the round to 1", "make the job's worktree"]);
  });

  it("carries the terminal flag, the hint and the skills", () => {
    expect(node("ready")?.terminal).toBe(true);
    expect(node("review")?.skills.map((s) => s.name)).toContain("qa-review");
    expect(node("shape")?.hint).toContain("shape.md");
  });

  it("lays out the review preset too, and a stage no move reaches still gets a spot", () => {
    expect(toGraph(factoryReviewPreset).nodes.map((n) => n.layer)).toEqual([0, 1, 2, 3, 4, 5, 1]);
    const lonely = toGraph({
      ...factoryBuildPreset,
      stages: [...factoryBuildPreset.stages, { id: "island", hint: "x", moves: [] }],
    });
    const island = lonely.nodes.find((n) => n.id === "island");
    expect(island).toBeDefined();
    expect(island?.layer).toBeGreaterThan(0);
  });
});
