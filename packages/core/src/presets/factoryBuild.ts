import { type Effect, NEEDS_HUMAN, type WorkflowDefinition } from "../domain/workflow";

const field = (doc: string, equals: string | readonly string[]) => ({
  kind: "doc-field" as const,
  doc,
  field: "STATUS",
  equals,
});

const rework: readonly Effect[] = [
  { kind: "bump-round" },
  { kind: "set-flag", name: "polished", value: false, whenStage: "build" },
];

const parkOnly = { to: NEEDS_HUMAN } as const;

/** The factory pipeline: shape, spec, build, gate, review, polish, prove, ship. */
export const factoryBuildPreset: WorkflowDefinition = {
  id: "factory",
  name: "Factory: build a feature",
  description:
    "Idea to a reviewed local commit, with gates and a human approval for the spec and the commit.",
  origin: "preset",
  initial: "shape",
  initialRound: 0,
  stages: [
    {
      id: "shape",
      role: "shaper",
      hint: "lets-talk-about-it -> shape.md (STATUS: READY, or reject with rejection.md)",
      skills: [{ name: "lets-talk-about-it", role: "shaper" }],
      moves: [
        { to: "spec", requires: [field("shape.md", "READY")] },
        { to: "rejected", requires: [{ kind: "doc-exists", doc: "rejection.md" }] },
      ],
    },
    {
      id: "spec",
      role: "planner",
      hint: "prd-mode -> spec.md and the tasks file, then wait for the user to approve",
      skills: [{ name: "prd-mode", role: "spec writer" }],
      moves: [
        {
          to: "build",
          requires: [
            { kind: "doc-exists", doc: "spec.md" },
            { kind: "approved", what: "spec" },
            { kind: "approval-current", what: "spec" },
          ],
          effects: [
            { kind: "set-round", value: 1 },
            { kind: "emit", name: "make-worktree" },
          ],
        },
      ],
    },
    {
      id: "build",
      role: "builder",
      hint: "swe plus stack skill, one task at a time -> build.md, then advance gate",
      skills: [{ name: "swe", role: "builder" }],
      moves: [
        { to: "gate", requires: [field("build.md", "READY")] },
        { to: NEEDS_HUMAN, requires: [field("build.md", "BLOCKED")] },
      ],
    },
    {
      id: "gate",
      role: "gatekeeper",
      hint: "run the gate, then advance review (or prove after polish) or build",
      moves: [
        {
          to: "review",
          requires: [
            { kind: "gate-run", message: "run `job gate` first" },
            { kind: "gate-is", equals: "PASS", message: "needs a passing gate before polish" },
            {
              kind: "flag",
              name: "polished",
              is: false,
              message: "needs a passing gate before polish",
            },
          ],
        },
        {
          to: "prove",
          requires: [
            { kind: "gate-run", message: "run `job gate` first" },
            { kind: "gate-is", equals: "PASS", message: "needs a passing gate after polish" },
            {
              kind: "flag",
              name: "polished",
              is: true,
              message: "needs a passing gate after polish",
            },
          ],
        },
        {
          to: "build",
          requires: [
            { kind: "gate-run", message: "run `job gate` first" },
            { kind: "gate-is", equals: "FAIL", message: "gate passed, nothing to rebuild" },
          ],
          effects: rework,
        },
        { to: NEEDS_HUMAN, requires: [{ kind: "gate-run", message: "run `job gate` first" }] },
      ],
    },
    {
      id: "review",
      role: "reviewer",
      hint: "reviewers -> round-N/review-<name>.md, reconcile-reviews -> reconcile.md, advance polish or build",
      skills: [
        { name: "code-review-frontend", role: "code reviewer" },
        { name: "qa-review", role: "qa reviewer" },
        { name: "test-review", role: "test reviewer" },
        { name: "reconcile-reviews", role: "reconciler" },
      ],
      moves: [
        { to: "polish", requires: [{ kind: "reviews-complete" }, { kind: "reviews-clean" }] },
        {
          to: "build",
          requires: [
            { kind: "reviews-complete" },
            { kind: "reviews-have-changes" },
            { kind: "doc-exists", doc: "reconcile.md" },
          ],
          effects: rework,
        },
        { to: NEEDS_HUMAN, requires: [{ kind: "reviews-complete" }] },
      ],
    },
    {
      id: "polish",
      role: "polisher",
      hint: "comment-sicko then simplify -> polish.md, then advance gate or build",
      skills: [{ name: "comment-sicko", role: "polisher" }, { name: "simplify" }],
      moves: [
        {
          to: "gate",
          requires: [field("polish.md", "DONE")],
          effects: [
            { kind: "set-flag", name: "polished", value: true },
            { kind: "emit", name: "clear-gate" },
          ],
        },
        { to: "build", requires: [field("polish.md", "REWORK")], effects: rework },
        parkOnly,
      ],
    },
    {
      id: "prove",
      role: "verifier",
      hint: "prove-it-works -> uat.md, then advance ship or build",
      skills: [{ name: "prove-it-works", role: "verifier" }],
      moves: [
        { to: "ship", requires: [field("uat.md", "PASS")] },
        { to: "build", requires: [field("uat.md", "FAIL")], effects: rework },
        parkOnly,
      ],
    },
    {
      id: "ship",
      role: "shipper",
      hint: "pr-body-style (+ demo-script) -> pr-body.md, wait for user approval, advance ready",
      skills: [{ name: "pr-body-style", role: "writer" }],
      moves: [
        {
          to: "ready",
          requires: [{ kind: "doc-exists", doc: "pr-body.md" }, { kind: "committed" }],
        },
        { to: "build", effects: rework },
        parkOnly,
      ],
    },
    { id: "ready", hint: "done", terminal: true, moves: [] },
    { id: "rejected", hint: "rejected", terminal: true, moves: [] },
  ],
};
