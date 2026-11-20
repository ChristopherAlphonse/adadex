import { isParsedRecord, isString, type ParsedValue } from "../util/typeCoercion";
import type { PolicyDecision, PolicyRules } from "../domain/policy";
import { evaluateShell, evaluateWrite } from "./evaluatePolicy";

const SHELL_TOOLS = new Set(["Bash", "bash", "execute_bash"]);

const WRITE_TOOLS = new Set([
  "Write",
  "Edit",
  "MultiEdit",
  "NotebookEdit",
  "write",
  "edit",
  "multiedit",
  "patch",
  "fs_write",
  "fs_append",
  "str_replace",
  "delete_file",
]);

const PATH_KEYS = ["path", "file_path", "filePath", "notebook_path"] as const;

const PATCH_FILE = /^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm;

const deny = (reason: string): PolicyDecision => ({ kind: "deny", reason });

/**
 * Judge one tool call an agent is about to make, in the shape Claude Code, OpenCode and Kiro hooks send:
 * `{tool_name, tool_input, cwd}`. Anything it cannot read is denied, so a malformed call never reads as allowed.
 * `resolvePath` turns a path from the call into the absolute real path to check (that is IO, so the caller supplies it).
 */
export const evaluateToolCall = (
  rules: PolicyRules,
  event: ParsedValue,
  resolvePath: (raw: string) => string,
): PolicyDecision => {
  const call = isParsedRecord(event) ? event : null;

  if (call === null || !isString(call.tool_name) || !isParsedRecord(call.tool_input))
    return deny("the policy could not read this call");

  const tool = call.tool_name;
  const input = call.tool_input;

  if (SHELL_TOOLS.has(tool)) {
    return isString(input.command)
      ? evaluateShell(rules, input.command, resolvePath)
      : deny("a command it cannot see");
  }

  if (!WRITE_TOOLS.has(tool)) return { kind: "allow" };

  const paths = PATH_KEYS.flatMap((k) => {
    const value = input[k];

    return isString(value) ? [value] : [];
  });

  if (isString(input.patchText))
    paths.push(...[...input.patchText.matchAll(PATCH_FILE)].map((m) => m[1] ?? ""));

  if (paths.length === 0) return deny("a write whose target file it cannot see");

  for (const raw of paths) {
    const verdict = evaluateWrite(rules, resolvePath(raw));

    if (verdict.kind !== "allow") return verdict;
  }

  return { kind: "allow" };
};
