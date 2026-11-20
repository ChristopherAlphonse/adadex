import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SkillCatalog, SkillInfo } from "@adadex/core";

export interface SkillSource {
  /** A label the user recognises, such as `calphonse-skills` or `my-team`. */
  readonly name: string;
  /** Folder holding `<skill>/SKILL.md` entries. */
  readonly dir: string;
}

/** The `name:` line of a SKILL.md front matter, or null when there is none. */
export const frontMatterName = (text: string): string | null => {
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1];
  const line = block?.split(/\r?\n/).find((l) => l.startsWith("name:"));
  const value = line
    ?.slice(5)
    .trim()
    .replace(/^["']|["']$/g, "");
  return value ? value : null;
};

const scan = async (source: SkillSource): Promise<SkillInfo[]> => {
  const entries = await readdir(source.dir, { withFileTypes: true }).catch(() => []);
  const found = await Promise.all(
    entries
      .filter((e) => e.isDirectory())
      .map(async (e): Promise<SkillInfo | null> => {
        const path = join(source.dir, e.name, "SKILL.md");
        const text = await readFile(path, "utf8").catch(() => null);
        return text === null
          ? null
          : { name: frontMatterName(text) ?? e.name, path, source: source.name };
      }),
  );
  return found.filter((s): s is SkillInfo => s !== null);
};

/**
 * Lists the skills in the folders this machine is configured with. The app ships none. Sources are in
 * priority order: when two folders have a skill of the same name, the earlier folder wins.
 */
export const createFsSkillCatalog = (sources: readonly SkillSource[]): SkillCatalog => ({
  async list() {
    const seen = new Set<string>();
    const out: SkillInfo[] = [];
    for (const source of sources) {
      for (const skill of (await scan(source)).sort((a, b) => a.name.localeCompare(b.name))) {
        if (seen.has(skill.name)) continue;
        seen.add(skill.name);
        out.push(skill);
      }
    }
    return out;
  },
});
