import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { isParsedRecord, isString, type ParsedValue } from "@adadex/core";

import type { SkillSource } from "../skills/fsSkillCatalog";

/** Settings that belong to one machine, not to a workflow: where skills live and how names map to local skills. */
export interface MachineConfig {
  readonly skillSources: readonly SkillSource[];
  readonly skillMap: Readonly<Record<string, string>>;
}

export const EMPTY_CONFIG: MachineConfig = { skillSources: [], skillMap: {} };

const nonEmpty = (v: ParsedValue | undefined): v is string => isString(v) && v !== "";

export type ConfigResult =
  | { readonly ok: true; readonly config: MachineConfig }
  | { readonly ok: false; readonly errors: readonly string[] };

/** Parses a machine config from an untrusted JSON value. */
export const parseMachineConfig = <T>(input: T): ConfigResult => {
  if (!isParsedRecord(input)) return { ok: false, errors: ["config must be an object"] };
  const errors: string[] = [];
  const sources: SkillSource[] = [];

  for (const [i, s] of (Array.isArray(input.skillSources) ? input.skillSources : []).entries()) {
    if (isParsedRecord(s) && nonEmpty(s.name) && nonEmpty(s.dir))
      sources.push({ name: s.name, dir: s.dir });
    else errors.push(`skill source ${i + 1} needs a name and a dir`);
  }

  const names = sources.map((s) => s.name);

  if (new Set(names).size !== names.length) errors.push("skill source names must be unique");

  const map: Record<string, string> = {};

  for (const [k, v] of Object.entries(isParsedRecord(input.skillMap) ? input.skillMap : {})) {
    if (nonEmpty(v)) map[k] = v;
    else errors.push(`skill map entry ${k} needs a skill name`);
  }

  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, config: { skillSources: sources, skillMap: map } };
};

export const loadMachineConfig = async (path: string): Promise<MachineConfig> => {
  const raw = await readFile(path, "utf8").catch(() => null);

  if (raw === null) return EMPTY_CONFIG;

  try {
    const r = parseMachineConfig(JSON.parse(raw));

    return r.ok ? r.config : EMPTY_CONFIG;
  } catch {
    return EMPTY_CONFIG;
  }
};

export const saveMachineConfig = async (
  path: string,
  input: ParsedValue,
): Promise<ConfigResult> => {
  const r = parseMachineConfig(input);

  if (!r.ok) return r;
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(r.config, null, 2)}\n`);
  await rename(tmp, path);

  return r;
};
