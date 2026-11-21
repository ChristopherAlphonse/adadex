import { realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

import { type ApprovalGate, evaluateToolCall, isString, type PolicyRules } from "@adadex/core";

import type { GuardDecide } from "../agents/guardHost";

/** Real path of a file that may not exist yet: resolve the deepest folder that does, so a symlink cannot hide a protected path. */
export const resolveReal = (cwd: string, raw: string): string => {
  const abs = isAbsolute(raw) ? resolve(raw) : resolve(cwd, raw);
  const tail: string[] = [];
  let dir = abs;

  for (;;) {
    try {
      return join(realpathSync(dir), ...tail.reverse());
    } catch {
      const parent = dirname(dir);

      if (parent === dir) return abs;
      tail.push(basename(dir));
      dir = parent;
    }
  }
};

/**
 * The decision for every tool call an agent makes: allowed, refused, or (for the `ask` cases such as a commit)
 * put in front of a person as an approval card. A refusal tells the agent why.
 */
export const createToolGuard =
  (
    rules: PolicyRules,
    approvals: ApprovalGate,
    log: (line: string) => void = () => {},
  ): GuardDecide =>
  async (event) => {
    const cwd = isString(
      /* SAFETY: preceding checks establish the invariant this assertion encodes. */ (
        event as { cwd?: unknown } | null
      )?.cwd,
    )
      ? /* SAFETY: preceding checks establish the invariant this assertion encodes. */ (
          event as { cwd: string }
        ).cwd
      : process.cwd();

    const verdict = evaluateToolCall(rules, event, (raw) => resolveReal(cwd, raw));

    const tool = String(
      /* SAFETY: preceding checks establish the invariant this assertion encodes. */ (
        event as { tool_name?: unknown } | null
      )?.tool_name,
    );

    if (verdict.kind === "allow") return { allow: true };

    if (verdict.kind === "deny") {
      log(`deny ${tool}: ${verdict.reason}`);

      return { allow: false, reason: verdict.reason };
    }

    log(`ask ${tool}: ${verdict.reason}`);
    const ok = await approvals.request(`tool:${tool}`, verdict.reason);

    return ok
      ? { allow: true }
      : { allow: false, reason: `${verdict.reason}; a person did not approve it` };
  };
