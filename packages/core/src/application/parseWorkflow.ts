import { EFFECT_NAMES, NEEDS_HUMAN, type WorkflowDefinition } from "../domain/workflow";

export type ParseWorkflowResult =
  | { readonly ok: true; readonly workflow: WorkflowDefinition }
  | { readonly ok: false; readonly errors: readonly string[] };

type Obj = Record<string, unknown>;
const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === "string" && v !== "";

/** Required fields per condition kind. `s` is a string, `b` a boolean, `e` a string or list of strings. */
const CONDITIONS: Readonly<Record<string, Readonly<Record<string, "s" | "b" | "e">>>> = {
  "doc-exists": { doc: "s" },
  "doc-field": { doc: "s", field: "s", equals: "e" },
  "doc-field-number": { doc: "s", field: "s" },
  "gate-run": {},
  "gate-is": { equals: "s" },
  "reviews-complete": {},
  "reviews-clean": {},
  "reviews-have-changes": {},
  approved: { what: "s" },
  "approval-current": { what: "s" },
  committed: {},
  flag: { name: "s", is: "b" },
};

const EFFECTS: Readonly<Record<string, Readonly<Record<string, "s" | "b" | "n" | "name">>>> = {
  "bump-round": {},
  "set-round": { value: "n" },
  "set-flag": { name: "s", value: "b" },
  emit: { name: "name" },
};

const checkFields = (
  where: string,
  kind: string,
  spec: Readonly<Record<string, string>>,
  value: Obj,
  errors: string[],
): void => {
  for (const [name, type] of Object.entries(spec)) {
    const v = value[name];
    const ok =
      type === "s"
        ? str(v)
        : type === "b"
          ? typeof v === "boolean"
          : type === "n"
            ? typeof v === "number" && Number.isInteger(v)
            : type === "name"
              ? EFFECT_NAMES.includes(v as never)
              : str(v) || (Array.isArray(v) && v.length > 0 && v.every(str));
    if (ok) continue;
    const shape: Readonly<Record<string, string>> = {
      b: " as true or false",
      n: " as a whole number",
      name: ` as ${EFFECT_NAMES.join(" or ")}`,
    };
    errors.push(`${where}: ${kind} needs ${name}${shape[type] ?? ""}`);
  }
};

const checkMove = (stageId: string, move: unknown, errors: string[]): void => {
  if (!isObj(move) || !str(move.to)) {
    errors.push(`stage ${stageId} has a move without a target`);
    return;
  }
  const where = `stage ${stageId} move to ${move.to}`;
  for (const c of Array.isArray(move.requires) ? move.requires : []) {
    const kind = isObj(c) ? c.kind : undefined;
    const spec = typeof kind === "string" ? CONDITIONS[kind] : undefined;
    if (!isObj(c) || typeof kind !== "string" || !spec)
      errors.push(`${where}: unknown condition kind ${String(kind)}`);
    else checkFields(where, kind, spec, c, errors);
  }
  for (const e of Array.isArray(move.effects) ? move.effects : []) {
    const kind = isObj(e) ? e.kind : undefined;
    const spec = typeof kind === "string" ? EFFECTS[kind] : undefined;
    if (!isObj(e) || typeof kind !== "string" || !spec)
      errors.push(`${where}: unknown effect kind ${String(kind)}`);
    else checkFields(where, kind, spec, e, errors);
  }
};

const targets = (stage: Obj): string[] =>
  (Array.isArray(stage.moves) ? stage.moves : []).flatMap((m) =>
    isObj(m) && str(m.to) ? [m.to] : [],
  );

const walk = (from: string, next: (id: string) => string[]): Set<string> => {
  const seen = new Set<string>([from]);
  const queue = [from];
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    for (const t of next(id)) {
      if (!seen.has(t)) {
        seen.add(t);
        queue.push(t);
      }
    }
  }
  return seen;
};

const checkShape = (stages: Obj[], initial: unknown, errors: string[]): void => {
  const ids = new Set<string>();
  for (const s of stages) {
    const id = String(s.id);
    if (id === NEEDS_HUMAN) errors.push(`${NEEDS_HUMAN} is reserved and cannot be a stage`);
    else if (ids.has(id)) errors.push(`duplicate stage ${id}`);
    ids.add(id);
  }
  const byId = new Map(stages.map((s) => [String(s.id), s]));
  if (!ids.has(String(initial))) errors.push(`initial stage ${String(initial)} does not exist`);

  for (const s of stages) {
    const id = String(s.id);
    const moves = targets(s);
    if (s.terminal === true && Array.isArray(s.moves) && s.moves.length > 0)
      errors.push(`terminal stage ${id} cannot have moves`);
    if (s.terminal !== true && moves.length === 0)
      errors.push(`stage ${id} has no moves and is not terminal`);
    for (const t of moves)
      if (t !== NEEDS_HUMAN && !ids.has(t)) errors.push(`stage ${id} moves to unknown stage ${t}`);
    for (const m of Array.isArray(s.moves) ? s.moves : []) checkMove(id, m, errors);
  }

  const terminals = stages.filter((s) => s.terminal === true).map((s) => String(s.id));
  if (terminals.length === 0) errors.push("a workflow needs at least one terminal stage");
  if (!ids.has(String(initial)) || terminals.length === 0) return;

  const reach = walk(String(initial), (id) =>
    targets(byId.get(id) ?? {}).filter((t) => ids.has(t)),
  );
  for (const id of ids)
    if (!reach.has(id)) errors.push(`stage ${id} cannot be reached from ${String(initial)}`);
  for (const id of ids) {
    if (!reach.has(id)) continue;
    const forward = walk(id, (x) => targets(byId.get(x) ?? {}).filter((t) => ids.has(t)));
    if (!terminals.some((t) => forward.has(t)))
      errors.push(`stage ${id} cannot reach a terminal stage`);
  }
};

/**
 * Validates a workflow a person wrote (JSON from a file or a form) and returns it as a user workflow,
 * or every problem found. Nothing here can weaken the safety rules: the human-only actions, the push
 * block and the policy live outside the workflow.
 */
export const parseWorkflow = (input: unknown): ParseWorkflowResult => {
  if (!isObj(input)) return { ok: false, errors: ["a workflow must be an object"] };
  const errors: string[] = [];
  if (!str(input.id) || !SLUG.test(input.id)) errors.push("id must match [a-z0-9][a-z0-9-]*");
  if (!str(input.name)) errors.push("name is required");
  if (!str(input.initial)) errors.push("initial stage is required");
  const round = input.initialRound ?? 0;
  if (input.unattended !== undefined && typeof input.unattended !== "boolean")
    errors.push("unattended must be true or false");
  if (typeof round !== "number" || !Number.isInteger(round) || round < 0)
    errors.push("initialRound must be a whole number, 0 or more");

  const raw = Array.isArray(input.stages) ? input.stages : [];
  if (raw.length === 0) errors.push("a workflow needs stages");
  const stages: Obj[] = [];
  for (const [i, s] of raw.entries()) {
    if (!isObj(s) || !str(s.id) || !SLUG.test(s.id))
      errors.push(`stage ${i + 1} needs an id matching [a-z0-9][a-z0-9-]*`);
    else if (!str(s.hint)) errors.push(`stage ${s.id} needs a hint`);
    else if (s.role !== undefined && (!str(s.role) || !SLUG.test(s.role)))
      errors.push(`stage ${s.id} role must be a role id`);
    else stages.push(s);
  }
  if (errors.length === 0 || stages.length > 0) checkShape(stages, input.initial, errors);
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    workflow: {
      ...(input as unknown as WorkflowDefinition),
      initialRound: round as number,
      origin: "user",
    },
  };
};
