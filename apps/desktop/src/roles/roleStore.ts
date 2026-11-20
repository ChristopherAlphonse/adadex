import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  type ActionRegistry,
  PRESET_ROLES,
  parseRole,
  type RoleDefinition,
  type WorkflowDefinition,
} from "@adadex/core";

export type RoleSave =
  | { readonly ok: true; readonly role: RoleDefinition }
  | { readonly ok: false; readonly errors: readonly string[] };

export interface RoleStore {
  list(): Promise<readonly RoleDefinition[]>;
  get(id: string): Promise<RoleDefinition | undefined>;
  /** Validates, then writes. A preset's id can never be overwritten. */
  save(input: unknown): Promise<RoleSave>;
  remove(id: string): Promise<RoleSave | { readonly ok: true }>;
}

const presetIds = new Set(PRESET_ROLES.map((r) => r.id));

/**
 * Roles are decided by people and read from the machine's data folder, which no agent can write. Anything on disk
 * that no longer validates is ignored, so a damaged or tampered file grants nothing.
 */
export const createRoleStore = (dir: string, registry: ActionRegistry): RoleStore => {
  const file = (id: string): string => join(dir, `${id}.json`);

  const readUser = async (): Promise<RoleDefinition[]> => {
    const out: RoleDefinition[] = [];

    for (const name of (await readdir(dir).catch(() => /* SAFETY: preceding checks establish the invariant this assertion encodes. */ [] as string[]))
      .filter((n) => n.endsWith(".json"))
      .sort()) {
      try {
        const r = parseRole(JSON.parse(await readFile(join(dir, name), "utf8")), registry);

        if (r.ok && !presetIds.has(r.role.id)) out.push(r.role);
      } catch {}
    }

    return out;
  };

  const list = async (): Promise<readonly RoleDefinition[]> => [
    ...PRESET_ROLES,
    ...(await readUser()),
  ];

  return {
    list,
    get: async (id) => (await list()).find((r) => r.id === id),
    async save(input) {
      const r = parseRole(input, registry);

      if (!r.ok) return r;

      if (presetIds.has(r.role.id))
        return { ok: false, errors: [`${r.role.id} is a preset and cannot be overwritten`] };
      await mkdir(dir, { recursive: true });
      const tmp = `${file(r.role.id)}.${process.pid}.tmp`;
      await writeFile(tmp, `${JSON.stringify(r.role, null, 2)}\n`);
      await rename(tmp, file(r.role.id));

      return r;
    },
    async remove(id) {
      if (presetIds.has(id))
        return { ok: false, errors: [`${id} is a preset and cannot be removed`] };

      if (!(await readUser()).some((r) => r.id === id))
        return { ok: false, errors: [`no user role ${id}`] };
      await rm(file(id), { force: true });

      return { ok: true };
    },
  };
};

/** Stage roles a workflow names that do not exist, so a bad workflow is caught before it runs. */
export const missingRoles = (
  def: WorkflowDefinition,
  known: ReadonlySet<string>,
): readonly string[] => [
  ...new Set(
    def.stages.flatMap((s) => (s.role !== undefined && !known.has(s.role) ? [s.role] : [])),
  ),
];
