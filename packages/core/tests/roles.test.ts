import { describe, expect, it } from "vitest";

import { createActionRegistry } from "../src/application/actionRegistry";
import { evaluateWrite } from "../src/application/evaluatePolicy";
import { evaluateToolCall } from "../src/application/evaluateToolCall";
import { parseRole } from "../src/application/parseRole";
import { planTick } from "../src/application/planTick";
import { authorizeForRole, policyForRole } from "../src/application/roleEnforcement";
import { runAgent } from "../src/application/runAgent";
import { FACTORY_ACTIONS } from "../src/domain/action";
import { newJob, type WorkflowJob } from "../src/domain/workflow";
import { factoryBuildPreset, factoryReviewPreset } from "../src/presets";
import { BUILD_POLICY } from "../src/presets/defaultPolicy";
import { PRESET_ROLES } from "../src/presets/roles";

const registry = createActionRegistry([
  ...FACTORY_ACTIONS,
  { id: "demo.ask", title: "Demo ask", touches: ["process"], class: "ask", parse: (i) => i },
]);
const roleOf = (id: string) => {
  const r = PRESET_ROLES.find((x) => x.id === id);
  if (!r) throw new Error(`no role ${id}`);
  return r;
};
const mine = (over: Record<string, unknown> = {}) => ({
  id: "my-role",
  name: "Mine",
  actions: ["job.advance"],
  advanceTo: ["gate"],
  tools: ["Read", "Write"],
  writeDocs: ["notes.md"],
  editsCode: false,
  limits: { maxActions: 10, maxSeconds: 60 },
  ...over,
});
const errorsOf = (input: unknown): readonly string[] => {
  const r = parseRole(input, registry);
  return r.ok ? [] : r.errors;
};

describe("the preset roles", () => {
  it("are all valid, and round-trip through the same validation a user role gets", () => {
    for (const r of PRESET_ROLES)
      expect(parseRole(JSON.parse(JSON.stringify(r)), registry).ok).toBe(true);
  });

  it("cover every stage of both workflows, and each role can make the moves its stage offers", () => {
    for (const def of [factoryBuildPreset, factoryReviewPreset]) {
      for (const stage of def.stages.filter((s) => !s.terminal)) {
        const role = PRESET_ROLES.find((r) => r.id === stage.role);
        expect(role, `${def.id}/${stage.id} needs a role`).toBeDefined();
        for (const m of stage.moves)
          expect(role?.advanceTo, `${stage.role} at ${stage.id} -> ${m.to}`).toContain(m.to);
      }
    }
  });

  it("grant no human-only action, no network tool, and never the app's own files", () => {
    for (const r of PRESET_ROLES) {
      for (const a of r.actions) expect(registry.get(a)?.class).not.toBe("human");
      expect(
        r.tools.every((t) =>
          ["Read", "Grep", "Glob", "Edit", "Write", "MultiEdit", "Bash"].includes(t),
        ),
      ).toBe(true);
      for (const d of r.writeDocs) expect(d).not.toMatch(/job\.json|audit\.log|checks\.md/);
    }
  });

  it("give read-only roles no way to edit code, and only builders and polishers edit it", () => {
    expect(PRESET_ROLES.filter((r) => r.editsCode).map((r) => r.id)).toEqual([
      "builder",
      "polisher",
    ]);
  });
});

describe("parseRole: a role cannot be a way around the rules", () => {
  it("accepts a small role and marks it as a user role", () => {
    const r = parseRole(mine(), registry);
    expect(r.ok && r.role.origin).toBe("user");
  });

  it("refuses to grant a human-only action, or an unknown one", () => {
    expect(errorsOf(mine({ actions: ["job.commit_local"] }))).toContain(
      "job.commit_local needs a human click and cannot be granted to a role",
    );
    expect(errorsOf(mine({ actions: ["job.approve_spec"] }))[0]).toContain("cannot be granted");
    expect(errorsOf(mine({ actions: ["git.push"] }))).toContain("unknown action git.push");
  });

  it("lets only an ask action be pre-approved, and only if the role has it", () => {
    expect(
      parseRole(mine({ actions: ["job.advance", "demo.ask"], autoApprove: ["demo.ask"] }), registry)
        .ok,
    ).toBe(true);
    expect(errorsOf(mine({ autoApprove: ["demo.ask"] }))).toContain(
      "autoApprove demo.ask is not one of the role's actions",
    );
    expect(errorsOf(mine({ autoApprove: ["job.advance"] }))).toContain(
      "autoApprove job.advance: only actions that ask for approval can be pre-approved",
    );
    expect(
      errorsOf(mine({ actions: ["job.commit_local"], autoApprove: ["job.commit_local"] })).length,
    ).toBeGreaterThan(0);
  });

  it("refuses a tool that is not on the list, such as a network tool", () => {
    expect(errorsOf(mine({ tools: ["Read", "WebFetch"] }))).toContain(
      "tool WebFetch is not available to a role",
    );
  });

  it("refuses to let a role write the gate result, the audit log or the job record", () => {
    for (const doc of ["checks.md", "round-1/checks.md", "audit.log", "job.json", "human.sha256"]) {
      expect(errorsOf(mine({ writeDocs: [doc] }))[0]).toContain("written only by the app");
    }
    expect(errorsOf(mine({ writeDocs: ["../outside.md"] }))[0]).toContain(
      "must stay inside the job folder",
    );
    expect(errorsOf(mine({ writeDocs: ["/etc/passwd"] }))[0]).toContain(
      "must stay inside the job folder",
    );
  });

  it("refuses an allowShell pattern that starts with a wildcard", () => {
    expect(errorsOf(mine({ allowShell: ["*"] }))[0]).toContain("too broad");
  });

  it("refuses moves with no job.advance, a bad limit, and a role that edits code with no way to", () => {
    expect(errorsOf(mine({ actions: [], advanceTo: ["gate"] }))).toContain(
      "advanceTo needs the job.advance action",
    );
    expect(errorsOf(mine({ limits: { maxActions: 0, maxSeconds: 60 } }))).toContain(
      "limits.maxActions must be a whole number from 1 to 1000",
    );
    expect(errorsOf(mine({ limits: { maxActions: 10, maxSeconds: 5 } }))).toContain(
      "limits.maxSeconds must be a whole number from 10 to 86400",
    );
    expect(errorsOf(mine({ editsCode: true, tools: ["Read"] }))).toContain(
      "a role that edits code needs Edit, Write, MultiEdit or Bash",
    );
  });

  it("reports every problem at once", () => {
    expect(errorsOf({ id: "Bad", actions: "x", tools: 1 }).length).toBeGreaterThan(3);
  });
});

describe("authorizeForRole: a role narrows, never widens", () => {
  const builder = roleOf("builder");
  const advance = (to: string) => ({ id: "j1", to });

  it("lets a role run its own actions and make its own moves", () => {
    expect(authorizeForRole(registry, builder, "job.advance", advance("gate"), false).kind).toBe(
      "run",
    );
  });

  it("refuses an action the role does not have, and a move outside the role", () => {
    expect(authorizeForRole(registry, builder, "job.run_gate", { id: "j1" }, false)).toEqual({
      kind: "deny",
      reason: "role builder may not run job.run_gate",
    });
    expect(authorizeForRole(registry, builder, "job.advance", advance("ready"), false)).toEqual({
      kind: "deny",
      reason: "role builder may not move a job to ready",
    });
    expect(authorizeForRole(registry, builder, "job.advance", advance("ship"), false).kind).toBe(
      "deny",
    );
  });

  it("a human-only action is never run for an agent, even in a role that somehow lists it", () => {
    const sneaky = {
      ...builder,
      actions: ["job.advance", "job.commit_local", "job.approve_spec", "job.unblock"],
    };
    for (const id of ["job.commit_local", "job.approve_spec", "job.unblock"]) {
      expect(authorizeForRole(registry, sneaky, id, { id: "j1" }, true).kind).toBe(
        "needs-human-click",
      );
    }
  });

  it("has no action that changes a role, so an agent cannot switch to a stronger one", () => {
    expect(registry.list().some((a) => /role|grant|permission|autonomy/i.test(a.id))).toBe(false);
    expect(authorizeForRole(registry, builder, "role.set", { role: "verifier" }, true).kind).toBe(
      "deny",
    );
    expect(authorizeForRole(registry, builder, "role.grant", {}, true).kind).toBe("deny");
  });

  it("pre-approves an ask action only when the role says so", () => {
    const asker = { ...builder, actions: ["job.advance", "demo.ask"], autoApprove: ["demo.ask"] };
    expect(authorizeForRole(registry, asker, "demo.ask", {}, false).kind).toBe("run");
    const plain = { ...builder, actions: ["job.advance", "demo.ask"] };
    expect(authorizeForRole(registry, plain, "demo.ask", {}, false).kind).toBe("ask");
    expect(authorizeForRole(registry, plain, "demo.ask", {}, true).kind).toBe("run");
  });

  it("still validates input, so a malformed call never reaches the runtime", () => {
    expect(
      authorizeForRole(registry, builder, "job.advance", { id: "Bad Id", to: "gate" }, false).kind,
    ).toBe("deny");
  });
});

describe("policyForRole: writes are limited to what the role owns", () => {
  const JOB = "/state/jobs/j1";
  const write = (roleId: string, path: string) =>
    evaluateToolCall(
      policyForRole(BUILD_POLICY, roleOf(roleId), { jobDir: JOB }),
      { tool_name: "Write", tool_input: { file_path: path }, cwd: "/wt" },
      (p) => p,
    ).kind;

  it("lets a builder write build.md and code, and nothing else in the job folder", () => {
    expect(write("builder", `${JOB}/build.md`)).toBe("allow");
    expect(write("builder", "/wt/src/app.ts")).toBe("allow");
    for (const other of [
      "spec.md",
      "uat.md",
      "pr-body.md",
      "round-1/review-code.md",
      "polish.md",
      "shape.md",
    ])
      expect(write("builder", `${JOB}/${other}`)).toBe("deny");
  });

  it("never lets any role forge the gate result, the audit log or the job record", () => {
    for (const r of PRESET_ROLES) {
      for (const f of ["round-1/checks.md", "checks.md", "audit.log", "job.json"])
        expect(write(r.id, `${JOB}/${f}`)).toBe("deny");
    }
  });

  it("keeps a reviewer from writing code or another role's documents, but lets it write its verdict", () => {
    expect(write("reviewer", "/wt/src/app.ts")).toBe("deny");
    expect(write("reviewer", `${JOB}/round-1/review-code.md`)).toBe("allow");
    expect(write("reviewer", `${JOB}/reconcile.md`)).toBe("allow");
    expect(write("reviewer", `${JOB}/uat.md`)).toBe("deny");
    expect(write("reviewer", `${JOB}/build.md`)).toBe("deny");
  });

  it("keeps a verifier from rewriting a reviewer's verdict", () => {
    expect(write("verifier", `${JOB}/uat.md`)).toBe("allow");
    expect(write("verifier", `${JOB}/round-1/review-code.md`)).toBe("deny");
  });

  it("does not relax what the base policy denies", () => {
    const wide = { ...roleOf("builder"), allowShell: ["git push*", "curl *"] };
    const policy = policyForRole(BUILD_POLICY, wide, { jobDir: JOB });
    const shell = (command: string) =>
      evaluateToolCall(policy, { tool_name: "Bash", tool_input: { command }, cwd: "/wt" }, (p) => p)
        .kind;
    expect(shell("git push origin main")).toBe("deny");
    expect(write("builder", "/wt/.github/workflows/ci.yml")).toBe("deny");
    expect(write("builder", "/wt/.env")).toBe("deny");
  });

  it("adds a role's own commands to what it may run", () => {
    const role = { ...roleOf("reviewer"), allowShell: ["make lint*"] };
    const policy = policyForRole(BUILD_POLICY, role, { jobDir: JOB });
    expect(
      evaluateToolCall(
        policy,
        { tool_name: "Bash", tool_input: { command: "make lint" }, cwd: "/wt" },
        (p) => p,
      ).kind,
    ).toBe("allow");
  });

  it("scopedWrites only affects paths under its own root", () => {
    const rules = { ...BUILD_POLICY, scopedWrites: [{ root: "/a", allow: ["ok.md"] }] };
    expect(evaluateWrite(rules, "/a/ok.md").kind).toBe("allow");
    expect(evaluateWrite(rules, "/a/no.md").kind).toBe("deny");
    expect(evaluateWrite(rules, "/b/anything.md").kind).toBe("allow");
    expect(evaluateWrite(rules, "/abc/no.md").kind).toBe("allow");
  });
});

describe("runAgent with a role", () => {
  it("uses the role's decision instead of the plain registry", async () => {
    const role = roleOf("builder");
    const seen: string[] = [];
    const events = [
      {
        type: "action" as const,
        callId: "1",
        actionId: "job.advance",
        input: { id: "j1", to: "gate" },
      },
      {
        type: "action" as const,
        callId: "2",
        actionId: "job.advance",
        input: { id: "j1", to: "ready" },
      },
      { type: "action" as const, callId: "3", actionId: "job.run_gate", input: { id: "j1" } },
      { type: "done" as const, summary: "" },
    ];
    const result = await runAgent(
      {
        provider: {
          id: "f",
          start: async () => ({
            events: async function* () {
              for (const e of events) yield e;
            },
            respond: async () => {},
            stop: async () => {},
          }),
        },
        registry,
        executor: {
          execute: async (id) => {
            seen.push(id);
            return {};
          },
        },
        approvals: { request: async () => true },
        authorize: (id, input, approved) => authorizeForRole(registry, role, id, input, approved),
      },
      { goal: "g", contextFiles: [] },
    );
    expect(seen).toEqual(["job.advance"]);
    expect(result.calls.map((c) => c.outcome.status)).toEqual(["ok", "denied", "denied"]);
  });
});

describe("planTick", () => {
  const at = (id: string, stage: string, over: Partial<WorkflowJob> = {}): WorkflowJob => ({
    ...newJob(factoryBuildPreset, id, id, { roundLimit: 3 }),
    stage,
    ...over,
  });
  const auto = { ...factoryBuildPreset, unattended: true };
  const cand = (job: WorkflowJob, stalls = 0) => ({ job, def: auto, stalls });
  const config = { concurrency: 2, stallLimit: 2 };

  it("starts a run for a job at a stage with a role, with that stage's role", () => {
    const plan = planTick([cand(at("a", "build"))], new Set(), config);
    expect(plan.start).toEqual([{ jobId: "a", stageId: "build", roleId: "builder" }]);
  });

  it("never starts a run for a job held for a person, finished, or already running", () => {
    const plan = planTick(
      [
        cand(at("a", "needs-human")),
        cand(at("b", "ready")),
        cand(at("c", "rejected")),
        cand(at("d", "build")),
      ],
      new Set(["d"]),
      config,
    );
    expect(plan.start).toEqual([]);
    expect(plan.skip.map((s) => `${s.jobId}: ${s.reason}`).sort()).toEqual([
      "a: held for a person",
      "b: held for a person",
      "c: held for a person",
      "d: already running",
    ]);
  });

  it("respects the concurrency limit and finishes the job that is furthest along first", () => {
    const plan = planTick(
      [cand(at("a", "shape")), cand(at("b", "gate")), cand(at("c", "build"))],
      new Set(),
      config,
    );
    expect(plan.start.map((s) => s.jobId)).toEqual(["b", "c"]);
    expect(plan.skip).toEqual([{ jobId: "a", reason: "waiting for a free slot" }]);
    expect(planTick([cand(at("a", "build"))], new Set(["x", "y"]), config).start).toEqual([]);
  });

  it("parks a job that keeps ending where it began, instead of looping forever", () => {
    const plan = planTick([cand(at("a", "build"), 2)], new Set(), config);
    expect(plan.park).toEqual([{ jobId: "a", reason: "2 runs in a row ended at build" }]);
    expect(plan.start).toEqual([]);
  });

  it("never works a job of a workflow that has not opted in, such as the factory preset", () => {
    const plan = planTick(
      [{ job: at("a", "build"), def: factoryBuildPreset, stalls: 0 }],
      new Set(),
      config,
    );
    expect(plan.start).toEqual([]);
    expect(plan.skip).toEqual([
      { jobId: "a", reason: "workflow factory is not set to run unattended" },
    ]);
  });

  it("leaves a stage with no role to a person", () => {
    const def = {
      ...auto,
      stages: auto.stages.map((s) => (s.id === "build" ? { ...s, role: undefined } : s)),
    };
    const plan = planTick([{ job: at("a", "build"), def, stalls: 0 }], new Set(), config);
    expect(plan.skip[0]?.reason).toContain("has no role");
  });
});
