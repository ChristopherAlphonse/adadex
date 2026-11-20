/** The stage a job parks in when only the user can move it. Every workflow has it. */
export const NEEDS_HUMAN = "needs-human";

/** A check that must hold before a move. Pure data, so a user can write one in a file or a form. */
export type Condition =
  | { readonly kind: "doc-exists"; readonly doc: string; readonly message?: string }
  | {
      readonly kind: "doc-field";
      readonly doc: string;
      readonly field: string;
      /** One accepted value, or several. */
      readonly equals: string | readonly string[];
      readonly message?: string;
    }
  | {
      readonly kind: "doc-field-number";
      readonly doc: string;
      readonly field: string;
      readonly message?: string;
    }
  | { readonly kind: "gate-run"; readonly message?: string }
  | { readonly kind: "gate-is"; readonly equals: string; readonly message?: string }
  | { readonly kind: "reviews-complete"; readonly message?: string }
  | { readonly kind: "reviews-clean"; readonly message?: string }
  | { readonly kind: "reviews-have-changes"; readonly message?: string }
  | { readonly kind: "approved"; readonly what: string; readonly message?: string }
  | { readonly kind: "approval-current"; readonly what: string; readonly message?: string }
  | { readonly kind: "committed"; readonly message?: string }
  | {
      readonly kind: "flag";
      readonly name: string;
      readonly is: boolean;
      readonly message?: string;
    };

/** Work the runtime must do when a move happens. Core only names it. */
export const EFFECT_NAMES = ["make-worktree", "clear-gate"] as const;
export type EffectName = (typeof EFFECT_NAMES)[number];

export type Effect =
  | { readonly kind: "bump-round" }
  | { readonly kind: "set-round"; readonly value: number }
  | {
      readonly kind: "set-flag";
      readonly name: string;
      readonly value: boolean;
      /** Apply only when the move lands on this stage (a round bump can park the job instead). */
      readonly whenStage?: string;
    }
  | { readonly kind: "emit"; readonly name: EffectName };

export interface MoveDef {
  readonly to: string;
  readonly requires?: readonly Condition[];
  readonly effects?: readonly Effect[];
}

/** A skill a stage uses, by name. Which file backs the name is decided per machine, not here. */
export interface SkillRef {
  readonly name: string;
  readonly role?: string;
}

export interface StageDef {
  readonly id: string;
  readonly title?: string;
  readonly hint: string;
  readonly skills?: readonly SkillRef[];
  readonly terminal?: boolean;
  readonly moves: readonly MoveDef[];
}

export interface WorkflowDefinition {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  /** `preset` ships with the app. `user` was made or edited by a person. */
  readonly origin: "preset" | "user";
  readonly initial: string;
  /** 0 for a build, 1 for a review that starts in its only round. */
  readonly initialRound: number;
  readonly stages: readonly StageDef[];
}

export interface WorkflowJob {
  readonly id: string;
  readonly title: string;
  readonly workflowId: string;
  readonly stage: string;
  readonly round: number;
  readonly roundLimit: number;
  readonly reviewers: readonly string[];
  readonly flags: Readonly<Record<string, boolean>>;
  /** Hash of each thing the user approved, by name (for example `spec`). */
  readonly approvals: Readonly<Record<string, string>>;
  readonly commit: string | null;
  readonly parkedFrom?: string;
  /** Where the job's code lives and on which branch, once a worktree has been made for it. */
  readonly worktree?: string;
  readonly branch?: string;
}

/**
 * What the infrastructure read from disk for the current stage. Core never touches the
 * filesystem: a document is "present" when its name is a key, and its `KEY: value` lines are the fields.
 */
export interface JobFacts {
  readonly docs: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** GATE value from the current round's checks file, when it exists. */
  readonly gate?: string;
  /** VERDICT per reviewer for the current round. A missing key means no review file. */
  readonly reviews: Readonly<Record<string, string | undefined>>;
  /** Current hash of each approvable thing, by name, when it exists. */
  readonly hashes?: Readonly<Record<string, string>>;
}

export const BASE_REVIEWERS: readonly string[] = ["code", "qa", "test"];

export const newJob = (
  def: WorkflowDefinition,
  id: string,
  title: string,
  opts: { roundLimit: number; reviewers?: readonly string[] },
): WorkflowJob => ({
  id,
  title,
  workflowId: def.id,
  stage: def.initial,
  round: def.initialRound,
  roundLimit: opts.roundLimit,
  reviewers: opts.reviewers ?? BASE_REVIEWERS,
  flags: {},
  approvals: {},
  commit: null,
});

export const stageOf = (def: WorkflowDefinition, id: string): StageDef | undefined =>
  def.stages.find((s) => s.id === id);
