import { NEEDS_HUMAN, type WorkflowDefinition } from "../domain/workflow";

const ready = (doc: string) => ({
  kind: "doc-field" as const,
  doc,
  field: "STATUS",
  equals: "READY",
});

const blocked = {
  kind: "doc-field" as const,
  doc: "blocked.md",
  field: "STATUS",
  equals: "BLOCKED",
};

const park = { to: NEEDS_HUMAN, requires: [blocked] } as const;

/** Read-only review of an existing branch. It never loops back to build. */
export const factoryReviewPreset: WorkflowDefinition = {
  id: "factory-review",
  name: "Factory review: review a branch",
  description:
    "Scope, parallel reviewers, reconcile, verify, report. Read-only: it never edits, commits or posts.",
  origin: "preset",
  initial: "scope",
  initialRound: 1,
  stages: [
    {
      id: "scope",
      role: "scoper",
      hint: "find the repo's own lint, type and test tooling -> scope.md (STATUS: READY, or reject with rejection.md)",
      moves: [
        { to: "review", requires: [ready("scope.md")] },
        { to: "rejected", requires: [{ kind: "doc-exists", doc: "rejection.md" }] },
        park,
      ],
    },
    {
      id: "review",
      role: "reviewer",
      hint: "code, qa, test and routed extras -> round-1/review-<name>.md; read-only, never edit",
      skills: [
        { name: "code-review-frontend", role: "code reviewer" },
        { name: "qa-review", role: "qa reviewer" },
        { name: "test-review", role: "test reviewer" },
      ],
      moves: [{ to: "reconcile", requires: [{ kind: "reviews-complete" }] }, park],
    },
    {
      id: "reconcile",
      role: "reconciler",
      hint: "reconcile-reviews -> reconcile.md (STATUS: READY), one ranked list with file and line",
      skills: [{ name: "reconcile-reviews", role: "reconciler" }],
      moves: [{ to: "verify", requires: [ready("reconcile.md")] }, park],
    },
    {
      id: "verify",
      role: "verifier",
      hint: "rerun every VERIFIED command and check every cited line -> verified.md (STATUS: READY)",
      skills: [{ name: "prove-it-works", role: "verifier" }],
      moves: [{ to: "report", requires: [ready("verified.md")] }, park],
    },
    {
      id: "report",
      role: "reporter",
      hint: "report.md (STATUS: READY, FINDINGS: n, BLOCKERS: n) and comments.md to paste by hand; never post",
      skills: [{ name: "simplify", role: "writer" }],
      moves: [
        {
          to: "ready",
          requires: [
            { ...ready("report.md"), message: "report.md needs STATUS: READY and FINDINGS: <n>" },
            {
              kind: "doc-field-number",
              doc: "report.md",
              field: "FINDINGS",
              message: "report.md needs STATUS: READY and FINDINGS: <n>",
            },
          ],
        },
        park,
      ],
    },
    { id: "ready", hint: "done", terminal: true, moves: [] },
    { id: "rejected", hint: "rejected", terminal: true, moves: [] },
  ],
};
