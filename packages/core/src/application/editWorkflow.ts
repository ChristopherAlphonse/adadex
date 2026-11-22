import {
  type Condition,
  type Effect,
  NEEDS_HUMAN,
  type SkillRef,
  type StageDef,
  type WorkflowDefinition,
} from "../domain/workflow";
import { parseWorkflow } from "./parseWorkflow";

export type EditResult =
  | { readonly ok: true; readonly workflow: WorkflowDefinition }
  | { readonly ok: false; readonly error: string };

const SLUG = /^[a-z0-9][a-z0-9-]*$/;

const fail = (error: string): EditResult => ({ ok: false, error });

const done = (workflow: WorkflowDefinition): EditResult => ({
  ok: true,
  workflow: { ...workflow, origin: "user" },
});

const stageOf = (w: WorkflowDefinition, id: string): StageDef | undefined =>
  w.stages.find((s) => s.id === id);

const mapStage = (
  w: WorkflowDefinition,
  id: string,
  f: (s: StageDef) => StageDef,
): WorkflowDefinition => ({
  ...w,
  stages: w.stages.map((s) => (s.id === id ? f(s) : s)),
});

/** A new, valid workflow with a start and an end, ready to grow. */
export const newWorkflow = (id: string, name: string): WorkflowDefinition => ({
  id,
  name,
  origin: "user",
  initial: "start",
  initialRound: 0,
  stages: [
    { id: "start", hint: "what happens first", moves: [{ to: "done" }] },
    { id: "done", hint: "finished", terminal: true, moves: [] },
  ],
});

/**
 * What stops this workflow from running, in words. Empty when it is fine.
 */
export const problemsOf = (w: WorkflowDefinition): readonly string[] => {
  const r = parseWorkflow(JSON.parse(JSON.stringify(w)));

  return r.ok ? [] : r.errors;
};

const checkId = (w: WorkflowDefinition, id: string): string | null => {
  if (id === NEEDS_HUMAN) return `${NEEDS_HUMAN} is reserved and cannot be a stage`;

  if (!SLUG.test(id)) return "stage id must match [a-z0-9][a-z0-9-]*";

  if (stageOf(w, id)) return `stage ${id} already exists`;

  return null;
};

export const addStage = (w: WorkflowDefinition, id: string, hint: string): EditResult => {
  const bad = checkId(w, id);

  return bad ? fail(bad) : done({ ...w, stages: [...w.stages, { id, hint, moves: [] }] });
};

export const removeStage = (w: WorkflowDefinition, id: string): EditResult => {
  if (!stageOf(w, id)) return fail(`no stage ${id}`);

  if (w.initial === id)
    return fail("the start stage cannot be removed; make another stage the start first");

  return done({
    ...w,
    stages: w.stages
      .filter((s) => s.id !== id)
      .map((s) => ({ ...s, moves: s.moves.filter((m) => m.to !== id) })),
  });
};

export const renameStage = (w: WorkflowDefinition, from: string, to: string): EditResult => {
  if (!stageOf(w, from)) return fail(`no stage ${from}`);
  const bad = from === to ? null : checkId(w, to);

  if (bad) return fail(bad);

  return done({
    ...w,
    initial: w.initial === from ? to : w.initial,
    stages: w.stages.map((s) => ({
      ...s,
      id: s.id === from ? to : s.id,
      moves: s.moves.map((m) => (m.to === from ? { ...m, to } : m)),
    })),
  });
};

export const setHint = (w: WorkflowDefinition, id: string, hint: string): EditResult =>
  stageOf(w, id) ? done(mapStage(w, id, (s) => ({ ...s, hint }))) : fail(`no stage ${id}`);

export const setSkills = (
  w: WorkflowDefinition,
  id: string,
  skills: readonly SkillRef[],
): EditResult =>
  stageOf(w, id) ? done(mapStage(w, id, (s) => ({ ...s, skills }))) : fail(`no stage ${id}`);

export const setInitial = (w: WorkflowDefinition, id: string): EditResult =>
  stageOf(w, id) ? done({ ...w, initial: id }) : fail(`no stage ${id}`);

export const setTerminal = (w: WorkflowDefinition, id: string, terminal: boolean): EditResult => {
  const s = stageOf(w, id);

  if (!s) return fail(`no stage ${id}`);

  if (terminal && s.moves.length > 0)
    return fail(`${id} has moves, so it cannot be terminal; remove them first`);

  return done(
    mapStage(w, id, ({ terminal: _old, ...rest }) =>
      terminal ? { ...rest, terminal: true } : rest,
    ),
  );
};

export const addMove = (w: WorkflowDefinition, from: string, to: string): EditResult => {
  const s = stageOf(w, from);

  if (!s) return fail(`no stage ${from}`);

  if (to !== NEEDS_HUMAN && !stageOf(w, to)) return fail(`no stage ${to}`);

  if (s.terminal === true) return fail(`${from} is a terminal stage and cannot have moves`);

  if (s.moves.some((m) => m.to === to)) return fail(`${from} already moves to ${to}`);

  return done(mapStage(w, from, (x) => ({ ...x, moves: [...x.moves, { to }] })));
};

const editMove = (
  w: WorkflowDefinition,
  from: string,
  to: string,
  f: (m: StageDef["moves"][number]) => StageDef["moves"][number],
): EditResult => {
  const s = stageOf(w, from);

  if (!s) return fail(`no stage ${from}`);

  if (!s.moves.some((m) => m.to === to)) return fail(`${from} does not move to ${to}`);

  return done(
    mapStage(w, from, (x) => ({ ...x, moves: x.moves.map((m) => (m.to === to ? f(m) : m)) })),
  );
};

export const removeMove = (w: WorkflowDefinition, from: string, to: string): EditResult => {
  const s = stageOf(w, from);

  if (!s) return fail(`no stage ${from}`);

  if (!s.moves.some((m) => m.to === to)) return fail(`${from} does not move to ${to}`);

  return done(mapStage(w, from, (x) => ({ ...x, moves: x.moves.filter((m) => m.to !== to) })));
};

export const setConditions = (
  w: WorkflowDefinition,
  from: string,
  to: string,
  requires: readonly Condition[],
): EditResult => editMove(w, from, to, (m) => ({ ...m, requires }));

export const setEffects = (
  w: WorkflowDefinition,
  from: string,
  to: string,
  effects: readonly Effect[],
): EditResult => editMove(w, from, to, (m) => ({ ...m, effects }));
