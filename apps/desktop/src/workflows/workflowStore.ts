import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  asRecord,
  PRESET_WORKFLOWS,
  parseWorkflow,
  type ParsedValue,
  type WorkflowDefinition,
} from "@adadex/core";

export type SaveResult =
  | { readonly ok: true; readonly workflow: WorkflowDefinition }
  | { readonly ok: false; readonly errors: readonly string[] };

export interface WorkflowStore {
  /** Presets first, then the user's workflows. */
  list(): Promise<readonly WorkflowDefinition[]>;
  get(id: string): Promise<WorkflowDefinition | undefined>;
  /** Validates, then writes. A preset's id can never be overwritten. */
  save<T>(input: T): Promise<SaveResult>;
  /** Copy any workflow (usually a preset) under a new id so it can be edited. */
  fork(fromId: string, newId: string, name: string): Promise<SaveResult>;
  remove(id: string): Promise<SaveResult | { readonly ok: true }>;
}

const presetIds = new Set(PRESET_WORKFLOWS.map((w) => w.id));

/** User workflows are JSON files, one per workflow, in `dir`. Files that no longer validate are skipped, not trusted. */
export const createWorkflowStore = (dir: string): WorkflowStore => {
  const file = (id: string): string => join(dir, `${id}.json`);

  const readUser = async (): Promise<WorkflowDefinition[]> => {
    const names = await readdir(dir).catch(() => []);
    const out: WorkflowDefinition[] = [];

    for (const name of names.filter((n) => n.endsWith(".json")).sort()) {
      const raw = await readFile(join(dir, name), "utf8").catch(() => "");
      let parsed: ParsedValue = null;

      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }

      const r = parseWorkflow(parsed);

      if (r.ok && !presetIds.has(r.workflow.id)) out.push(r.workflow);
    }

    return out;
  };

  const list = async (): Promise<readonly WorkflowDefinition[]> => [
    ...PRESET_WORKFLOWS,
    ...(await readUser()),
  ];

  const get = async (id: string): Promise<WorkflowDefinition | undefined> =>
    (await list()).find((w) => w.id === id);

  const save = async <T>(input: T): Promise<SaveResult> => {
    const r = parseWorkflow(asRecord(input) ?? null);

    if (!r.ok) return r;

    if (presetIds.has(r.workflow.id)) {
      return {
        ok: false,
        errors: [`${r.workflow.id} is a preset and cannot be overwritten. Fork it under a new id.`],
      };
    }

    await mkdir(dir, { recursive: true });
    const tmp = `${file(r.workflow.id)}.${process.pid}.tmp`;
    await writeFile(tmp, `${JSON.stringify(r.workflow, null, 2)}\n`);
    await rename(tmp, file(r.workflow.id));

    return r;
  };

  return {
    list,
    get,
    save,
    async fork(fromId, newId, name) {
      const source = await get(fromId);

      if (!source) return { ok: false, errors: [`no workflow ${fromId}`] };

      if (await get(newId)) return { ok: false, errors: [`${newId} already exists`] };

      return save({ ...source, id: newId, name, origin: "user" });
    },
    async remove(id) {
      if (presetIds.has(id))
        return { ok: false, errors: [`${id} is a preset and cannot be removed`] };

      if (!(await readUser()).some((w) => w.id === id))
        return { ok: false, errors: [`no user workflow ${id}`] };
      await rm(file(id), { force: true });

      return { ok: true };
    },
  };
};
