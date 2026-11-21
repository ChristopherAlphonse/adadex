import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { isNumber, isString } from "@adadex/core";

import type { GateConfig } from "../jobs/gatePorts";

/** A gate config filled in one checked field at a time. */
type GateConfigDraft = { -readonly [K in keyof GateConfig]?: GateConfig[K] };

/** The project's `checks` command and gate limits, read from the machine's data folder, never from the repo an agent edits. */
export const loadProjectChecks = async (path: string): Promise<Partial<GateConfig> | null> => {
  try {
    // SAFETY: the file is untrusted JSON; every field is checked before it reaches the gate config.
    const raw = JSON.parse(await readFile(path, "utf8")) as Partial<GateConfig>;
    const checks: GateConfigDraft = {};

    if (isString(raw.checks)) checks.checks = raw.checks;

    if (isNumber(raw.timeoutMs)) checks.timeoutMs = raw.timeoutMs;

    if (isString(raw.baseBranch)) checks.baseBranch = raw.baseBranch;

    if (Array.isArray(raw.protectedPaths))
      checks.protectedPaths = raw.protectedPaths.filter((p) => isString(p));

    return checks;
  } catch {
    return null;
  }
};

/** A command the native dialog can show in full: one line, no control characters. */
export const checkCommandError = (command: string): string | null => {
  if (command.trim() === "") return "the checks command cannot be empty";

  if (command.length > 2000) return "the checks command must be 2000 characters or fewer";

  // oxlint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(command)) return "the checks command must be one line";

  return null;
};

/** Replace only `checks`, keeping the other gate settings in the file as they are. */
export const saveProjectChecks = async (path: string, checks: string): Promise<void> => {
  const current = (await loadProjectChecks(path)) ?? {};
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify({ ...current, checks }, null, 2)}\n`);
  await rename(tmp, path);
};
