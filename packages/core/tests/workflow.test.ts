import { describe, expect, it } from "vitest";

import { advanceJob, approve } from "../src/application/advanceJob";
import { type JobFacts, newJob, stageOf, type WorkflowJob } from "../src/domain/workflow";
import {
  factoryBuildPreset as buildWorkflow,
  factoryReviewPreset as reviewWorkflow,
} from "../src/presets";

const noFacts: JobFacts = { docs: {}, reviews: {} };

const facts = (over: Partial<JobFacts> = {}): JobFacts => ({ ...noFacts, ...over });

const at = (stage: string, over: Partial<WorkflowJob> = {}): WorkflowJob => ({
  ...newJob(buildWorkflow, "j1", "title", { roundLimit: 3 }),
  stage,
  ...over,
});

describe("preset definitions", () => {
  it("only move to stages that exist", () => {
    for (const def of [buildWorkflow, reviewWorkflow]) {
      const known = new Set([...def.stages.map((st) => st.id), "needs-human"]);

      for (const st of def.stages) {
        for (const m of st.moves) expect(known.has(m.to)).toBe(true);
      }
    }
  });

  it("starts a build job at shape and a review job at scope", () => {
    expect(newJob(buildWorkflow, "a", "t", { roundLimit: 3 }).stage).toBe("shape");
    const review = newJob(reviewWorkflow, "a", "t", { roundLimit: 3 });
    expect(review.stage).toBe("scope");
    expect(review.round).toBe(1);
  });

  it("matches factory's table of legal moves", () => {
    const table = Object.fromEntries(
      buildWorkflow.stages
        .filter((st) => !st.terminal)
        .map((st) => [st.id, st.moves.map((m) => m.to).sort()]),
    );

    expect(table).toEqual({
      "shape": ["rejected", "spec"],
      spec: ["build"],
      build: ["gate", "needs-human"],
      gate: ["build", "needs-human", "prove", "review"],
      review: ["build", "needs-human", "polish"],
      polish: ["build", "gate", "needs-human"],
      prove: ["build", "needs-human", "ship"],
      ship: ["build", "needs-human", "ready"],
    });
    expect(stageOf(buildWorkflow, "ready")?.terminal).toBe(true);
  });
});

describe("advanceJob: legality", () => {
  it("refuses a move the table does not list", () => {
    const r = advanceJob(buildWorkflow, at("shape"), "build", noFacts);
    expect(r).toEqual({ ok: false, reason: "shape -> build is not a legal move" });
  });

  it("refuses to move a terminal or human-held job", () => {
    for (const stage of ["ready", "rejected", "needs-human"]) {
      const r = advanceJob(buildWorkflow, at(stage), "build", noFacts);
      expect(r.ok).toBe(false);
    }
  });
});

describe("advanceJob: evidence", () => {
  it("shape -> spec needs shape.md STATUS: READY", () => {
    expect(advanceJob(buildWorkflow, at("shape"), "spec", noFacts).ok).toBe(false);

    const ok = advanceJob(
      buildWorkflow,
      at("shape"),
      "spec",
      facts({ docs: { "shape.md": { STATUS: "READY" } } }),
    );

    expect(ok.ok).toBe(true);
  });

  it("shape -> rejected needs rejection.md", () => {
    expect(advanceJob(buildWorkflow, at("shape"), "rejected", noFacts).ok).toBe(false);

    const ok = advanceJob(
      buildWorkflow,
      at("shape"),
      "rejected",
      facts({ docs: { "rejection.md": {} } }),
    );

    expect(ok.ok).toBe(true);
  });

  it("spec -> build needs spec.md, the user's approval, and an unchanged spec", () => {
    const docs = { "spec.md": {} };
    expect(advanceJob(buildWorkflow, at("spec"), "build", facts({ docs })).ok).toBe(false);
    const approved = approve(at("spec"), "spec", "sha-1");

    const changed = advanceJob(
      buildWorkflow,
      approved,
      "build",
      facts({ docs, hashes: { spec: "sha-2" } }),
    );

    expect(changed).toEqual({ ok: false, reason: "spec changed since the user approved it" });

    const ok = advanceJob(
      buildWorkflow,
      approved,
      "build",
      facts({ docs, hashes: { spec: "sha-1" } }),
    );

    expect(ok.ok && ok.job.round).toBe(1);
    expect(ok.ok && ok.effects).toContain("make-worktree");
  });

  it("build -> gate needs STATUS: READY and build -> needs-human needs BLOCKED", () => {
    expect(
      advanceJob(
        buildWorkflow,
        at("build"),
        "gate",
        facts({ docs: { "build.md": { STATUS: "BLOCKED" } } }),
      ).ok,
    ).toBe(false);
    expect(
      advanceJob(
        buildWorkflow,
        at("build"),
        "gate",
        facts({ docs: { "build.md": { STATUS: "READY" } } }),
      ).ok,
    ).toBe(true);

    const parked = advanceJob(
      buildWorkflow,
      at("build"),
      "needs-human",
      facts({ docs: { "build.md": { STATUS: "BLOCKED" } } }),
    );

    expect(parked.ok && parked.job.stage).toBe("needs-human");
    expect(parked.ok && parked.job.parkedFrom).toBe("build");
  });
});

describe("advanceJob: gate, review, polish, prove, ship", () => {
  it("gate needs a run first, then routes by result and polish state", () => {
    expect(advanceJob(buildWorkflow, at("gate"), "review", noFacts)).toEqual({
      ok: false,
      reason: "run `job gate` first",
    });
    expect(advanceJob(buildWorkflow, at("gate"), "review", facts({ gate: "PASS" })).ok).toBe(true);
    expect(
      advanceJob(
        buildWorkflow,
        at("gate", { flags: { polished: true } }),
        "review",
        facts({ gate: "PASS" }),
      ).ok,
    ).toBe(false);
    expect(
      advanceJob(
        buildWorkflow,
        at("gate", { flags: { polished: true } }),
        "prove",
        facts({ gate: "PASS" }),
      ).ok,
    ).toBe(true);
    expect(advanceJob(buildWorkflow, at("gate"), "prove", facts({ gate: "PASS" })).ok).toBe(false);
  });

  it("a failing gate rebuilds and counts a round; a passing gate has nothing to rebuild", () => {
    expect(
      advanceJob(buildWorkflow, at("gate", { round: 1 }), "build", facts({ gate: "PASS" })).ok,
    ).toBe(false);
    const r = advanceJob(buildWorkflow, at("gate", { round: 1 }), "build", facts({ gate: "FAIL" }));
    expect(r.ok && r.job.round).toBe(2);
    expect(r.ok && r.job.stage).toBe("build");
  });

  it("parks the job on the user once rounds run out", () => {
    const r = advanceJob(
      buildWorkflow,
      at("gate", { round: 3, roundLimit: 3 }),
      "build",
      facts({ gate: "FAIL" }),
    );

    expect(r.ok && r.job.stage).toBe("needs-human");
    expect(r.ok && r.job.parkedFrom).toBe("gate");
  });

  it("rebuilding resets the polished flag", () => {
    const r = advanceJob(
      buildWorkflow,
      at("gate", { flags: { polished: true }, round: 1 }),
      "build",
      facts({ gate: "FAIL" }),
    );

    expect(r.ok && r.job.flags.polished).toBe(false);
  });

  it("review needs every reviewer's verdict", () => {
    const job = at("review", { reviewers: ["code", "qa"] });
    const r = advanceJob(buildWorkflow, job, "polish", facts({ reviews: { code: "PASS" } }));
    expect(r).toEqual({ ok: false, reason: "missing reviews: qa" });
  });

  it("review -> polish needs no open CHANGES; review -> build needs some and a reconcile", () => {
    const job = at("review", { reviewers: ["code", "qa"], round: 1 });
    const open = facts({ reviews: { code: "PASS", qa: "CHANGES" }, docs: { "reconcile.md": {} } });
    expect(advanceJob(buildWorkflow, job, "polish", open)).toEqual({
      ok: false,
      reason: "open CHANGES from: qa",
    });
    const back = advanceJob(buildWorkflow, job, "build", open);
    expect(back.ok && back.job.round).toBe(2);
    const clean = facts({ reviews: { code: "PASS", qa: "PASS" } });
    expect(advanceJob(buildWorkflow, job, "polish", clean).ok).toBe(true);
    expect(advanceJob(buildWorkflow, job, "build", clean).ok).toBe(false);
    const noReconcile = facts({ reviews: { code: "CHANGES", qa: "PASS" } });
    expect(advanceJob(buildWorkflow, job, "build", noReconcile)).toEqual({
      ok: false,
      reason: "reconcile.md missing",
    });
  });

  it("polish -> gate marks the job polished and clears the gate result", () => {
    const r = advanceJob(
      buildWorkflow,
      at("polish"),
      "gate",
      facts({ docs: { "polish.md": { STATUS: "DONE" } } }),
    );

    expect(r.ok && r.job.flags.polished).toBe(true);
    expect(r.ok && r.effects).toContain("clear-gate");
    expect(
      advanceJob(
        buildWorkflow,
        at("polish"),
        "gate",
        facts({ docs: { "polish.md": { STATUS: "REWORK" } } }),
      ).ok,
    ).toBe(false);
  });

  it("prove needs PASS to ship and FAIL to rebuild", () => {
    expect(
      advanceJob(
        buildWorkflow,
        at("prove"),
        "ship",
        facts({ docs: { "uat.md": { STATUS: "PASS" } } }),
      ).ok,
    ).toBe(true);
    expect(
      advanceJob(
        buildWorkflow,
        at("prove"),
        "ship",
        facts({ docs: { "uat.md": { STATUS: "FAIL" } } }),
      ).ok,
    ).toBe(false);

    const back = advanceJob(
      buildWorkflow,
      at("prove", { round: 1 }),
      "build",
      facts({ docs: { "uat.md": { STATUS: "FAIL" } } }),
    );

    expect(back.ok && back.job.round).toBe(2);
  });

  it("ship -> ready needs pr-body.md and a local commit", () => {
    const docs = { "pr-body.md": {} };
    expect(advanceJob(buildWorkflow, at("ship"), "ready", facts({ docs })).ok).toBe(false);
    expect(advanceJob(buildWorkflow, at("ship"), "ready", facts()).ok).toBe(false);

    const ok = advanceJob(
      buildWorkflow,
      at("ship", { commit: "abc123" }),
      "ready",
      facts({ docs }),
    );

    expect(ok.ok && ok.job.stage).toBe("ready");
  });
});

describe("advanceJob: review workflow", () => {
  const rev = (stage: string, over: Partial<WorkflowJob> = {}): WorkflowJob => ({
    ...newJob(reviewWorkflow, "r1", "t", { roundLimit: 3 }),
    stage,
    ...over,
  });

  it("walks scope -> review -> reconcile -> verify -> report -> ready", () => {
    const steps: [string, string, JobFacts][] = [
      ["scope", "review", facts({ docs: { "scope.md": { STATUS: "READY" } } })],
      ["review", "reconcile", facts({ reviews: { code: "PASS", qa: "CHANGES", test: "PASS" } })],
      ["reconcile", "verify", facts({ docs: { "reconcile.md": { STATUS: "READY" } } })],
      ["verify", "report", facts({ docs: { "verified.md": { STATUS: "READY" } } })],
      ["report", "ready", facts({ docs: { "report.md": { STATUS: "READY", FINDINGS: "2" } } })],
    ];

    for (const [from, to, f] of steps) {
      const r = advanceJob(reviewWorkflow, rev(from), to, f);
      expect(r.ok && r.job.stage).toBe(to);
    }
  });

  it("report needs a numeric FINDINGS count", () => {
    const r = advanceJob(
      reviewWorkflow,
      rev("report"),
      "ready",
      facts({ docs: { "report.md": { STATUS: "READY", FINDINGS: "x" } } }),
    );

    expect(r.ok).toBe(false);
  });

  it("parks on blocked.md alone, without the stage's usual evidence", () => {
    expect(advanceJob(reviewWorkflow, rev("review"), "needs-human", noFacts).ok).toBe(false);

    const r = advanceJob(
      reviewWorkflow,
      rev("review"),
      "needs-human",
      facts({ docs: { "blocked.md": { STATUS: "BLOCKED" } } }),
    );

    expect(r.ok && r.job.parkedFrom).toBe("review");
  });

  it("never loops back to build", () => {
    expect(advanceJob(reviewWorkflow, rev("review"), "build", noFacts).ok).toBe(false);
  });
});

describe("approve", () => {
  it("records the hash of what the user approved", () => {
    const job = approve(at("spec"), "spec", "sha-9");
    expect(job.approvals).toEqual({ spec: "sha-9" });
  });
});
