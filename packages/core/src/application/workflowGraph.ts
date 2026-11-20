import {
  type Condition,
  type Effect,
  NEEDS_HUMAN,
  type SkillRef,
  type WorkflowDefinition,
} from "../domain/workflow";

const list = (v: string | readonly string[]): string =>
  typeof v === "string" ? v : v.join(" or ");

/** A condition in plain words, for the side panel and the edge labels. */
export const describeCondition = (c: Condition): string => {
  switch (c.kind) {
    case "doc-exists":
      return `${c.doc} exists`;
    case "doc-field":
      return `${c.doc} has ${c.field}: ${list(c.equals)}`;
    case "doc-field-number":
      return `${c.doc} has a number in ${c.field}`;
    case "gate-run":
      return "the gate has been run";
    case "gate-is":
      return `the gate is ${c.equals}`;
    case "reviews-complete":
      return "every reviewer has answered";
    case "reviews-clean":
      return "no reviewer asked for changes";
    case "reviews-have-changes":
      return "a reviewer asked for changes";
    case "approved":
      return `you approved the ${c.what}`;
    case "approval-current":
      return `the ${c.what} is unchanged since you approved it`;
    case "committed":
      return "a local commit was made";
    case "flag":
      return `${c.name} is ${c.is ? "on" : "off"}`;
  }
};

export const describeEffect = (e: Effect): string => {
  switch (e.kind) {
    case "bump-round":
      return "count a round, and park the job if rounds run out";
    case "set-round":
      return `set the round to ${e.value}`;
    case "set-flag":
      return `turn ${e.name} ${e.value ? "on" : "off"}`;
    case "emit":
      return e.name === "make-worktree" ? "make the job's worktree" : "clear the gate result";
  }
};

export interface GraphNode {
  readonly id: string;
  readonly hint: string;
  readonly skills: readonly SkillRef[];
  readonly terminal: boolean;
  /** True when some move parks the job on a person. Drawn as a badge. */
  readonly canPark: boolean;
  readonly layer: number;
  readonly x: number;
  readonly y: number;
}

export interface GraphEdge {
  readonly from: string;
  readonly to: string;
  /** `back` goes to an earlier stage (a loop). */
  readonly kind: "forward" | "back";
  readonly requires: readonly string[];
  readonly effects: readonly string[];
}

export interface WorkflowGraph {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

const GAP_X = 220;
const GAP_Y = 120;

/**
 * Turn a workflow into something a canvas can draw: stages placed left to right by how far they are from the start,
 * moves as edges (loops marked), and moves to needs-human as a badge. Pure, and it works on invalid workflows too,
 * because a person drawing one passes through invalid states.
 */
export const toGraph = (def: WorkflowDefinition): WorkflowGraph => {
  const ids = new Set(def.stages.map((s) => s.id));
  const layer = new Map<string, number>([[def.initial, 0]]);
  const queue = [def.initial];
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    const from = layer.get(id) ?? 0;
    for (const m of def.stages.find((s) => s.id === id)?.moves ?? []) {
      if (ids.has(m.to) && !layer.has(m.to)) {
        layer.set(m.to, from + 1);
        queue.push(m.to);
      }
    }
  }
  const last = Math.max(0, ...layer.values());
  for (const s of def.stages) if (!layer.has(s.id)) layer.set(s.id, last + 1);

  const rowsUsed = new Map<number, number>();
  const nodes = def.stages.map((s): GraphNode => {
    const l = layer.get(s.id) ?? 0;
    const row = rowsUsed.get(l) ?? 0;
    rowsUsed.set(l, row + 1);
    return {
      id: s.id,
      hint: s.hint,
      skills: s.skills ?? [],
      terminal: s.terminal === true,
      canPark: s.moves.some((m) => m.to === NEEDS_HUMAN),
      layer: l,
      x: l * GAP_X,
      y: row * GAP_Y,
    };
  });

  const edges = def.stages.flatMap((s) =>
    s.moves
      .filter((m) => ids.has(m.to))
      .map((m): GraphEdge => ({
        from: s.id,
        to: m.to,
        kind: (layer.get(m.to) ?? 0) <= (layer.get(s.id) ?? 0) ? "back" : "forward",
        requires: (m.requires ?? []).map(describeCondition),
        effects: (m.effects ?? []).map(describeEffect),
      })),
  );
  return { nodes, edges };
};
