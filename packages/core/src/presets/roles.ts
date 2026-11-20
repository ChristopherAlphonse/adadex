import type { RoleDefinition, RoleTool } from "../domain/role";

const READ: RoleTool[] = ["Read", "Grep", "Glob"];
const BUILD: RoleTool[] = [...READ, "Edit", "Write", "MultiEdit", "Bash"];

const role = (
  r: Omit<RoleDefinition, "origin" | "actions" | "advanceTo"> & {
    actions?: string[];
    advanceTo?: string[];
  },
): RoleDefinition => ({
  ...r,
  origin: "preset",
  actions: r.actions ?? ["job.advance"],
  advanceTo: r.advanceTo ?? [],
});

/**
 * The baseline roles. Each gets the least it needs: read-only roles cannot edit code, no role can write the gate
 * result, the audit log or the job record, and none can run an action that needs a human click.
 */
export const PRESET_ROLES: readonly RoleDefinition[] = [
  role({
    id: "shaper",
    name: "Shaper",
    description: "Turns an idea into a short shape, or rejects it.",
    tools: [...READ, "Write"],
    writeDocs: ["shape.md", "rejection.md"],
    editsCode: false,
    advanceTo: ["spec", "rejected", "needs-human"],
    limits: { maxActions: 40, maxSeconds: 900 },
  }),
  role({
    id: "planner",
    name: "Planner",
    description: "Writes the spec and the task list. A person approves the spec.",
    tools: [...READ, "Write"],
    writeDocs: ["spec.md", "tasks.md"],
    editsCode: false,
    advanceTo: ["build", "needs-human"],
    limits: { maxActions: 60, maxSeconds: 1800 },
  }),
  role({
    id: "builder",
    name: "Builder",
    description: "Writes the code, one task at a time.",
    tools: BUILD,
    writeDocs: ["build.md"],
    editsCode: true,
    advanceTo: ["gate", "needs-human"],
    limits: { maxActions: 300, maxSeconds: 3600 },
  }),
  role({
    id: "gatekeeper",
    name: "Gatekeeper",
    description: "Runs the checks and routes the job by the result.",
    tools: READ,
    actions: ["job.run_gate", "job.advance"],
    writeDocs: [],
    editsCode: false,
    advanceTo: ["review", "prove", "build", "needs-human"],
    limits: { maxActions: 20, maxSeconds: 600 },
  }),
  role({
    id: "reviewer",
    name: "Reviewer",
    description: "Reviews read-only and writes verdicts.",
    tools: [...READ, "Bash", "Write"],
    writeDocs: ["round-*/review-*.md", "reconcile.md"],
    editsCode: false,
    advanceTo: ["polish", "build", "reconcile", "needs-human"],
    limits: { maxActions: 120, maxSeconds: 1800 },
  }),
  role({
    id: "polisher",
    name: "Polisher",
    description: "Cleans up the code after review.",
    tools: BUILD,
    writeDocs: ["polish.md"],
    editsCode: true,
    advanceTo: ["gate", "build", "needs-human"],
    limits: { maxActions: 200, maxSeconds: 2400 },
  }),
  role({
    id: "verifier",
    name: "Verifier",
    description: "Checks the real result and writes what it found.",
    tools: [...READ, "Bash", "Write"],
    writeDocs: ["uat.md", "verified.md"],
    editsCode: false,
    advanceTo: ["ship", "build", "report", "needs-human"],
    limits: { maxActions: 100, maxSeconds: 1800 },
  }),
  role({
    id: "shipper",
    name: "Shipper",
    description: "Writes the PR body and the commit message. A person commits.",
    tools: [...READ, "Write"],
    writeDocs: ["pr-body.md", "commit.md"],
    editsCode: false,
    advanceTo: ["ready", "build", "needs-human"],
    limits: { maxActions: 40, maxSeconds: 900 },
  }),
  role({
    id: "scoper",
    name: "Scoper",
    description: "Scopes a review of a branch.",
    tools: [...READ, "Bash", "Write"],
    writeDocs: ["scope.md", "rejection.md"],
    editsCode: false,
    advanceTo: ["review", "rejected", "needs-human"],
    limits: { maxActions: 60, maxSeconds: 900 },
  }),
  role({
    id: "reconciler",
    name: "Reconciler",
    description: "Merges reviews into one ranked list.",
    tools: [...READ, "Write"],
    writeDocs: ["reconcile.md"],
    editsCode: false,
    advanceTo: ["verify", "needs-human"],
    limits: { maxActions: 60, maxSeconds: 1200 },
  }),
  role({
    id: "reporter",
    name: "Reporter",
    description: "Writes the final report. It never posts.",
    tools: [...READ, "Write"],
    writeDocs: ["report.md", "comments.md"],
    editsCode: false,
    advanceTo: ["ready", "needs-human"],
    limits: { maxActions: 40, maxSeconds: 900 },
  }),
];
