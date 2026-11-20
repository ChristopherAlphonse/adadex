import type { ActionContext, ActionDef, AuthorizeResult } from "../domain/action";
import type { ParsedValue } from "../util/typeCoercion";

export interface ActionRegistry {
  has(id: string): boolean;
  get(id: string): ActionDef | undefined;
  list(): readonly ActionDef[];
}

const NEVER_REGISTERED = new Set(["git.push", "pr.open", "pr.create", "mr.open", "mr.create"]);

export const createActionRegistry = (defs: readonly ActionDef[]): ActionRegistry => {
  const byId = new Map<string, ActionDef>();

  for (const def of defs) {
    if (NEVER_REGISTERED.has(def.id))
      throw new Error(`${def.id} is never allowed: it publishes work`);

    if (def.touches.includes("git-remote"))
      throw new Error(`${def.id} reaches a git remote, which is not allowed`);

    if (byId.has(def.id)) throw new Error(`duplicate action ${def.id}`);
    byId.set(def.id, def);
  }

  return {
    has: (id) => byId.has(id),
    get: (id) => byId.get(id),
    list: () => [...byId.values()],
  };
};

const message = (cause: unknown): string =>
  cause instanceof Error ? cause.message : "invalid input";

/** Decide whether a call may run now. Input is validated first, so an invalid call never reaches the runtime. */
export const authorize = (
  registry: ActionRegistry,
  id: string,
  rawInput: ParsedValue,
  ctx: ActionContext,
): AuthorizeResult => {
  const def = registry.get(id);

  if (!def) return { kind: "deny", reason: `unknown action ${id}` };

  let input: ParsedValue;

  try {
    input = def.parse(rawInput);
  } catch (cause) {
    return { kind: "deny", reason: message(cause) };
  }

  if (def.class === "human") {
    const clicked = ctx.caller === "human" && ctx.humanClick?.actionId === def.id;

    return clicked
      ? { kind: "run", input }
      : { kind: "needs-human-click", reason: `${def.title} needs a human click` };
  }

  if (def.class === "ask") {
    const approved = ctx.caller === "human" || ctx.approvedActionId === def.id;

    return approved
      ? { kind: "run", input }
      : { kind: "ask", reason: `${def.title} needs approval` };
  }

  return { kind: "run", input };
};
