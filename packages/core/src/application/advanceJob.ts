import {
  type Condition,
  type Effect,
  type EffectName,
  type JobFacts,
  NEEDS_HUMAN,
  stageOf,
  type WorkflowDefinition,
  type WorkflowJob,
} from "../domain/workflow";
import { isString } from "../util/typeCoercion";

export type AdvanceResult =
  | { readonly ok: true; readonly job: WorkflowJob; readonly effects: readonly EffectName[] }
  | { readonly ok: false; readonly reason: string };

const refuse = (reason: string): AdvanceResult => ({ ok: false, reason });

const equalsList = (equals: string | readonly string[]): readonly string[] =>
  isString(equals) ? [equals] : equals;

/** Returns the reason a condition fails, or null when it holds. */
const failure = (c: Condition, job: WorkflowJob, facts: JobFacts): string | null => {
  const say = (fallback: string): string => c.message ?? fallback;

  switch (c.kind) {
    case "doc-exists":
      return c.doc in facts.docs ? null : say(`${c.doc} missing`);
    case "doc-field": {
      const value = facts.docs[c.doc]?.[c.field];
      const accepted = equalsList(c.equals);

      return value !== undefined && accepted.includes(value)
        ? null
        : say(`${c.doc} needs ${c.field}: ${accepted.join(" or ")}`);
    }

    case "doc-field-number":
      return /^\d+$/.test(facts.docs[c.doc]?.[c.field] ?? "")
        ? null
        : say(`${c.doc} needs ${c.field}: <n>`);
    case "gate-run":
      return facts.gate ? null : say("run the gate first");
    case "gate-is":
      return facts.gate === c.equals ? null : say(`the gate must be ${c.equals}`);
    case "reviews-complete": {
      const missing = job.reviewers.filter((r) => !facts.reviews[r]);

      return missing.length === 0 ? null : say(`missing reviews: ${missing.join(", ")}`);
    }

    case "reviews-clean": {
      const open = job.reviewers.filter((r) => facts.reviews[r] === "CHANGES");

      return open.length === 0 ? null : say(`open CHANGES from: ${open.join(", ")}`);
    }

    case "reviews-have-changes":
      return job.reviewers.some((r) => facts.reviews[r] === "CHANGES")
        ? null
        : say("all reviews passed, nothing to rebuild");
    case "approved":
      return job.approvals[c.what] !== undefined ? null : say(`${c.what} not approved by the user`);
    case "approval-current":
      return job.approvals[c.what] !== undefined && job.approvals[c.what] === facts.hashes?.[c.what]
        ? null
        : say(`${c.what} changed since the user approved it`);
    case "committed":
      return job.commit !== null
        ? null
        : say("nothing committed: the user commits locally from the board");
    case "flag":
      return (job.flags[c.name] ?? false) === c.is ? null : say(`flag ${c.name} must be ${c.is}`);
  }
};

interface Applied {
  readonly job: WorkflowJob;
  readonly to: string;
  readonly emitted: readonly EffectName[];
}

const applyEffect = (state: Applied, effect: Effect): Applied => {
  switch (effect.kind) {
    case "set-round":
      return { ...state, job: { ...state.job, round: effect.value } };
    case "bump-round": {
      const round = state.job.round + 1;

      return {
        ...state,
        job: { ...state.job, round },
        to: round > state.job.roundLimit ? NEEDS_HUMAN : state.to,
      };
    }

    case "set-flag":
      return effect.whenStage !== undefined && effect.whenStage !== state.to
        ? state
        : {
            ...state,
            job: { ...state.job, flags: { ...state.job.flags, [effect.name]: effect.value } },
          };
    case "emit":
      return { ...state, emitted: [...state.emitted, effect.name] };
  }
};

/**
 * Pure stage move for any workflow: legality, evidence, round counting and effects all come from the
 * definition. Returns the next job plus the effects the caller must perform (core does no IO).
 */
export const advanceJob = (
  def: WorkflowDefinition,
  job: WorkflowJob,
  to: string,
  facts: JobFacts,
): AdvanceResult => {
  const stage = stageOf(def, job.stage);

  if (job.stage === NEEDS_HUMAN || stage?.terminal === true) {
    return refuse(`${job.id} is ${job.stage}, only the user can move it`);
  }

  const move = stage?.moves.find((m) => m.to === to);

  if (!move) return refuse(`${job.stage} -> ${to} is not a legal move`);

  for (const condition of move.requires ?? []) {
    const reason = failure(condition, job, facts);

    if (reason !== null) return refuse(reason);
  }

  /* SAFETY: the seed has the job, the target stage and no effects, which is exactly the Applied shape. */
  const applied = (move.effects ?? []).reduce(applyEffect, { job, to, emitted: [] } as Applied);
  let next = { ...applied.job, stage: applied.to };

  if (applied.to === NEEDS_HUMAN) next = { ...next, parkedFrom: job.stage };

  return { ok: true, job: next, effects: applied.emitted };
};

/** The user approves a thing as it is now. Callers must have verified a human click first. */
export const approve = (job: WorkflowJob, what: string, hash: string): WorkflowJob => ({
  ...job,
  approvals: { ...job.approvals, [what]: hash },
});
