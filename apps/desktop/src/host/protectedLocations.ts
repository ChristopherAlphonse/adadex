import type { PolicyRules } from "@adadex/core";

/**
 * Add places an agent may never write: the machine config (where the gate's `checks` command is read from), the
 * app's state folder, and the generated git hooks. Without this an agent could change what runs at the gate.
 */
export const withProtectedLocations = (
  policy: PolicyRules,
  locations: readonly string[],
): PolicyRules => ({
  ...policy,
  noWrite: [...policy.noWrite, ...locations.flatMap((l) => [l, `${l.replace(/\/+$/, "")}/**`])],
});
