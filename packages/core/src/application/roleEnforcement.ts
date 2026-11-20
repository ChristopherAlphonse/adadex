import type { ActionContext, AuthorizeResult } from "../domain/action";
import type { PolicyRules } from "../domain/policy";
import type { RoleDefinition } from "../domain/role";
import { type ActionRegistry, authorize } from "./actionRegistry";

const deny = (reason: string): AuthorizeResult => ({ kind: "deny", reason });

/**
 * Decide an action call for an agent working in `role`. The role narrows what the registry would allow and never
 * widens it: an action outside the role is refused, a move to a stage outside the role is refused, and a
 * human-only action still needs a human click whatever the role says.
 */
export const authorizeForRole = (
  registry: ActionRegistry,
  role: RoleDefinition,
  actionId: string,
  rawInput: unknown,
  approved: boolean,
): AuthorizeResult => {
  if (!role.actions.includes(actionId)) return deny(`role ${role.id} may not run ${actionId}`);

  const preApproved = approved || (role.autoApprove?.includes(actionId) ?? false);
  const ctx: ActionContext = {
    caller: "agent",
    ...(preApproved ? { approvedActionId: actionId } : {}),
  };
  const decision = authorize(registry, actionId, rawInput, ctx);

  if (decision.kind === "run" && actionId === "job.advance") {
    const to = (decision.input as { to?: unknown }).to;
    if (typeof to !== "string" || !role.advanceTo.includes(to))
      return deny(`role ${role.id} may not move a job to ${String(to)}`);
  }
  return decision;
};

export interface RoleScope {
  /** The job's state folder. */
  readonly jobDir: string;
}

/**
 * The policy one run works under: the base policy with the role's extra commands, and writes limited to the
 * documents the role owns. Deny and ask rules and the protected files come from the base and are never relaxed.
 */
export const policyForRole = (
  base: PolicyRules,
  role: RoleDefinition,
  scope: RoleScope,
): PolicyRules => {
  const dir = scope.jobDir.replace(/\/+$/, "");
  return {
    allow: [...base.allow, ...(role.allowShell ?? [])],
    deny: base.deny,
    ask: base.ask,
    noWrite: [
      ...base.noWrite,
      `${dir}/job.json`,
      `${dir}/audit.log`,
      `${dir}/**/checks.md`,
      `${dir}/checks.md`,
    ],
    writeOnly: role.editsCode ? base.writeOnly : [`${dir}/**`],
    scopedWrites: [...(base.scopedWrites ?? []), { root: dir, allow: role.writeDocs }],
  };
};
