import { describe, expect, it } from "vitest";

import { advanceJob } from "../src/application/advanceJob";
import { parseWorkflow } from "../src/application/parseWorkflow";
import { newJob } from "../src/domain/workflow";
import { PRESET_WORKFLOWS } from "../src/presets";
import type { ParsedValue } from "../src/util/typeCoercion";

const minimal = () => ({
  id: "my-flow",
  name: "My flow",
  initial: "draft",
  stages: [
    {
      id: "draft",
      hint: "write it",
      skills: [{ name: "my-writer" }],
      moves: [
        {
          to: "done",
          requires: [{ kind: "doc-field", doc: "draft.md", field: "STATUS", equals: "READY" }],
        },
      ],
    },
    { id: "done", hint: "finished", terminal: true, moves: [] },
  ],
});

const errorsOf = (input: ParsedValue): string[] => {
  const r = parseWorkflow(input);

  return r.ok ? [] : r.errors;
};

describe("parseWorkflow", () => {
  it("accepts a small user workflow and marks it as a user one", () => {
    const r = parseWorkflow(minimal());
    expect(r.ok && r.workflow.origin).toBe("user");
    expect(r.ok && r.workflow.initialRound).toBe(0);
  });

  it("accepts both presets, once they are serialized and read back", () => {
    for (const preset of PRESET_WORKFLOWS) {
      const r = parseWorkflow(JSON.parse(JSON.stringify(preset)));
      expect(r.ok).toBe(true);
    }
  });

  it("a parsed workflow runs in the engine", () => {
    const r = parseWorkflow(minimal());

    if (!r.ok) throw new Error("parse failed");
    const job = newJob(r.workflow, "j1", "t", { roundLimit: 3 });
    const facts = { docs: { "draft.md": { STATUS: "READY" } }, reviews: {} };
    const moved = advanceJob(r.workflow, job, "done", facts);
    expect(moved.ok && moved.job.stage).toBe("done");
  });

  it("accepts unattended as a true or false choice and refuses anything else", () => {
    expect(parseWorkflow({ ...minimal(), unattended: true }).ok).toBe(true);
    expect(errorsOf({ ...minimal(), unattended: "yes" })).toContain(
      "unattended must be true or false",
    );
  });

  it("rejects anything that is not an object", () => {
    expect(errorsOf(null)).toEqual(["a workflow must be an object"]);
    expect(errorsOf("x")).toEqual(["a workflow must be an object"]);
  });

  it("rejects a missing id, a bad id, and a missing name", () => {
    expect(errorsOf({ ...minimal(), id: "Bad Id" })).toContain("id must match [a-z0-9][a-z0-9-]*");
    expect(errorsOf({ ...minimal(), name: "" })).toContain("name is required");
  });

  it("rejects a move to a stage that does not exist", () => {
    const w = minimal();
    w.stages[0]?.moves.push(
      /* SAFETY: this test intentionally feeds malformed data to the parser; the cast only bypasses fixture typing. */ {
        to: "nowhere",
      } as never,
    );
    expect(errorsOf(w)).toContain("stage draft moves to unknown stage nowhere");
  });

  it("allows a move to needs-human but not a stage named needs-human", () => {
    const w = minimal();
    w.stages[0]?.moves.push(
      /* SAFETY: this test intentionally feeds malformed data to the parser; the cast only bypasses fixture typing. */ {
        to: "needs-human",
      } as never,
    );
    expect(errorsOf(w)).toEqual([]);
    w.stages.push(
      /* SAFETY: this test intentionally feeds malformed data to the parser; the cast only bypasses fixture typing. */ {
        id: "needs-human",
        hint: "x",
        moves: [],
      } as never,
    );
    expect(errorsOf(w)).toContain("needs-human is reserved and cannot be a stage");
  });

  it("rejects duplicate stage ids and an unknown start stage", () => {
    const w = minimal();
    w.stages.push(
      /* SAFETY: this test intentionally feeds malformed data to the parser; the cast only bypasses fixture typing. */ {
        id: "draft",
        hint: "dup",
        moves: [],
      } as never,
    );
    expect(errorsOf(w)).toContain("duplicate stage draft");
    expect(errorsOf({ ...minimal(), initial: "zzz" })).toContain(
      "initial stage zzz does not exist",
    );
  });

  it("rejects a terminal stage with moves and a stage with no way out", () => {
    const w = minimal();
    w.stages[1] =
      /* SAFETY: this test intentionally feeds malformed data to the parser; the cast only bypasses fixture typing. */ {
        id: "done",
        hint: "x",
        terminal: true,
        moves: [{ to: "draft" }],
      } as never;
    expect(errorsOf(w)).toContain("terminal stage done cannot have moves");
    const dead = minimal();
    dead.stages[0] =
      /* SAFETY: this test intentionally feeds malformed data to the parser; the cast only bypasses fixture typing. */ {
        id: "draft",
        hint: "x",
        moves: [],
      } as never;
    expect(errorsOf(dead)).toContain("stage draft has no moves and is not terminal");
  });

  it("rejects a workflow with no terminal stage, an unreachable stage, and a loop that cannot finish", () => {
    const noEnd = minimal();
    noEnd.stages[1] =
      /* SAFETY: this test intentionally feeds malformed data to the parser; the cast only bypasses fixture typing. */ {
        id: "done",
        hint: "x",
        moves: [{ to: "draft" }],
      } as never;
    expect(errorsOf(noEnd)).toContain("a workflow needs at least one terminal stage");
    const orphan = minimal();
    orphan.stages.push(
      /* SAFETY: this test intentionally feeds malformed data to the parser; the cast only bypasses fixture typing. */ {
        id: "island",
        hint: "x",
        terminal: true,
        moves: [],
      } as never,
    );
    expect(errorsOf(orphan)).toContain("stage island cannot be reached from draft");
    const loop = minimal();
    loop.stages.push(
      /* SAFETY: this test intentionally feeds malformed data to the parser; the cast only bypasses fixture typing. */ {
        id: "a",
        hint: "x",
        moves: [{ to: "b" }],
      } as never,
      /* SAFETY: this test intentionally feeds malformed data to the parser; the cast only bypasses fixture typing. */ {
        id: "b",
        hint: "x",
        moves: [{ to: "a" }],
      } as never,
    );
    loop.stages[0]?.moves.push(
      /* SAFETY: this test intentionally feeds malformed data to the parser; the cast only bypasses fixture typing. */ {
        to: "a",
      } as never,
    );
    expect(errorsOf(loop)).toContain("stage a cannot reach a terminal stage");
  });

  it("rejects an unknown condition kind, a missing field, and a wrong type", () => {
    const w = minimal();
    w.stages[0] =
      /* SAFETY: this test intentionally feeds malformed data to the parser; the cast only bypasses fixture typing. */ {
        id: "draft",
        hint: "x",
        moves: [{ to: "done", requires: [{ kind: "vibes" }] }],
      } as never;
    expect(errorsOf(w)).toContain("stage draft move to done: unknown condition kind vibes");
    w.stages[0] =
      /* SAFETY: this test intentionally feeds malformed data to the parser; the cast only bypasses fixture typing. */ {
        id: "draft",
        hint: "x",
        moves: [{ to: "done", requires: [{ kind: "doc-exists" }] }],
      } as never;
    expect(errorsOf(w)).toContain("stage draft move to done: doc-exists needs doc");
    w.stages[0] =
      /* SAFETY: this test intentionally feeds malformed data to the parser; the cast only bypasses fixture typing. */ {
        id: "draft",
        hint: "x",
        moves: [{ to: "done", requires: [{ kind: "flag", name: "p", is: "yes" }] }],
      } as never;
    expect(errorsOf(w)).toContain("stage draft move to done: flag needs is as true or false");
  });

  it("rejects an unknown effect and an effect name the runtime does not know", () => {
    const w = minimal();
    w.stages[0] =
      /* SAFETY: this test intentionally feeds malformed data to the parser; the cast only bypasses fixture typing. */ {
        id: "draft",
        hint: "x",
        moves: [{ to: "done", effects: [{ kind: "emit", name: "rm-rf" }] }],
      } as never;
    expect(errorsOf(w)).toContain(
      "stage draft move to done: emit needs name as make-worktree or clear-gate",
    );
    w.stages[0] =
      /* SAFETY: this test intentionally feeds malformed data to the parser; the cast only bypasses fixture typing. */ {
        id: "draft",
        hint: "x",
        moves: [{ to: "done", effects: [{ kind: "explode" }] }],
      } as never;
    expect(errorsOf(w)).toContain("stage draft move to done: unknown effect kind explode");
  });

  it("reports every problem at once", () => {
    expect(errorsOf({ id: "Bad", name: "", initial: "x", stages: [] }).length).toBeGreaterThan(2);
  });
});
