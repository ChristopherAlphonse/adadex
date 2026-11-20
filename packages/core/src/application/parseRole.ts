import { ROLE_TOOLS, type RoleDefinition } from "../domain/role";
import {
  isBoolean,
  isNumber,
  isParsedRecord,
  isString,
  type ParsedRecord,
  type ParsedValue,
} from "../util/typeCoercion";
import type { ActionRegistry } from "./actionRegistry";

export type ParseRoleResult =
  | { readonly ok: true; readonly role: RoleDefinition }
  | { readonly ok: false; readonly errors: readonly string[] };

const SLUG = /^[a-z0-9][a-z0-9-]*$/;

const isObj = <T>(v: T): v is T & ParsedRecord => isParsedRecord(v);

const text = (v: ParsedValue | undefined): v is string => isString(v) && v !== "";

const strings = (v: ParsedValue | undefined): v is string[] => Array.isArray(v) && v.every(text);

/** Files in a job's folder that only the app writes. No role can be granted them, whatever its writeDocs say. */
const APP_ONLY = ["job.json", "audit.log", "checks.md", "human"];

const badDoc = (pattern: string): string | null => {
  if (pattern.startsWith("/") || pattern.split("/").includes(".."))
    return `writeDocs ${pattern} must stay inside the job folder`;
  const name = pattern.split("/").at(-1) ?? "";

  return APP_ONLY.some((f) => name === f || name.startsWith(`${f}.`))
    ? `writeDocs ${pattern} is written only by the app`
    : null;
};

/**
 * Validate a role a person wrote. The rules that keep a role from becoming a way around the safety rules are here,
 * not in the UI: a human-only action can never be granted, an unknown tool or action is refused, and writing
 * the app's own files (the gate result, the audit log, the job record) can never be granted.
 */
export const parseRole = (input: ParsedValue, registry: ActionRegistry): ParseRoleResult => {
  if (!isObj(input)) return { ok: false, errors: ["a role must be an object"] };
  const errors: string[] = [];

  if (!text(input.id) || !SLUG.test(input.id)) errors.push("id must match [a-z0-9][a-z0-9-]*");

  if (!text(input.name)) errors.push("name is required");

  const actions = strings(input.actions) ? input.actions : [];

  if (!strings(input.actions)) errors.push("actions must be a list of action ids");

  for (const a of actions) {
    const def = registry.get(a);

    if (!def) errors.push(`unknown action ${a}`);
    else if (def.class === "human")
      errors.push(`${a} needs a human click and cannot be granted to a role`);
  }

  const auto =
    input.autoApprove === undefined ? [] : strings(input.autoApprove) ? input.autoApprove : null;

  if (auto === null) errors.push("autoApprove must be a list of action ids");

  for (const a of auto ?? []) {
    if (!actions.includes(a)) errors.push(`autoApprove ${a} is not one of the role's actions`);
    else if (registry.get(a)?.class !== "ask")
      errors.push(`autoApprove ${a}: only actions that ask for approval can be pre-approved`);
  }

  if (
    !strings(input.advanceTo) ||
    (input.advanceTo.length > 0 && !actions.includes("job.advance"))
  ) {
    errors.push(
      strings(input.advanceTo)
        ? "advanceTo needs the job.advance action"
        : "advanceTo must be a list of stage ids",
    );
  } else if (!input.advanceTo.every((s) => SLUG.test(s)))
    errors.push("advanceTo entries must be stage ids");

  const tools = Array.isArray(input.tools) ? input.tools : [];

  if (!Array.isArray(input.tools)) errors.push("tools must be a list");

  for (const t of tools)
    if (!ROLE_TOOLS.some((tool) => tool === t))
      errors.push(`tool ${String(t)} is not available to a role`);

  const allow =
    input.allowShell === undefined ? [] : strings(input.allowShell) ? input.allowShell : null;

  if (allow === null) errors.push("allowShell must be a list of commands");

  for (const p of allow ?? [])
    if (p.trim().startsWith("*"))
      errors.push(`allowShell ${p} is too broad: it must start with a command name`);

  if (!strings(input.writeDocs)) errors.push("writeDocs must be a list of file globs");
  else
    for (const d of input.writeDocs) {
      const bad = badDoc(d);

      if (bad) errors.push(bad);
    }

  if (!isBoolean(input.editsCode)) errors.push("editsCode must be true or false");
  else if (
    input.editsCode &&
    !tools.some((t) => t === "Edit" || t === "Write" || t === "MultiEdit" || t === "Bash")
  ) {
    errors.push("a role that edits code needs Edit, Write, MultiEdit or Bash");
  }

  const limits = isObj(input.limits) ? input.limits : null;

  const whole = (v: unknown, min: number, max: number): v is number =>
    isNumber(v) && Number.isInteger(v) && v >= min && v <= max;

  if (!limits || !whole(limits.maxActions, 1, 1000))
    errors.push("limits.maxActions must be a whole number from 1 to 1000");

  if (!limits || !whole(limits.maxSeconds, 10, 86400))
    errors.push("limits.maxSeconds must be a whole number from 10 to 86400");

  if (errors.length > 0) return { ok: false, errors };

  // SAFETY: id and name are non-empty strings, the id lists are string lists, tools are on ROLE_TOOLS,
  // writeDocs are safe globs and limits are whole numbers; origin is set below so a preset cannot be forged.
  const role = input as ParsedRecord & RoleDefinition;

  return { ok: true, role: { ...role, origin: "user" } };
};
