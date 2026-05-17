import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import type { DeckAvailableSkill } from "@adadex/core";

const SKILL_MARKERS = [
  { start: "<!-- adadex:suggested-skills:start -->", end: "<!-- adadex:suggested-skills:end -->" },
  {
    start: "<!-- octogent:suggested-skills:start -->",
    end: "<!-- octogent:suggested-skills:end -->",
  },
] as const;
const FRONT_MATTER_PATTERN = /^---\n([\s\S]*?)\n---\n?/;
const H1_PATTERN = /^#\s+(.+)$/m;

const normalizeSkillNames = (skills: readonly string[]): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const skill of skills) {
    const trimmed = skill.trim();
    if (trimmed.length === 0 || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized.sort((a, b) => a.localeCompare(b));
};

const readSkillMetadata = (
  skillFilePath: string,
): { name: string; description: string; title: string | null } => {
  const fallbackName =
    basename(skillFilePath, ".md") === "SKILL"
      ? basename(dirname(skillFilePath))
      : basename(skillFilePath, ".md");
  try {
    const content = readFileSync(skillFilePath, "utf8");
    const frontMatterMatch = content.match(FRONT_MATTER_PATTERN);
    let name: string | null = null;
    let description = "";

    if (frontMatterMatch) {
      for (const line of (frontMatterMatch[1] ?? "").split("\n")) {
        const separatorIndex = line.indexOf(":");
        if (separatorIndex <= 0) continue;

        const key = line.slice(0, separatorIndex).trim();
        const rawValue = line.slice(separatorIndex + 1).trim();
        const value = rawValue.replace(/^['"]|['"]$/g, "");
        if (key === "name" && value.length > 0) {
          name = value;
        } else if (key === "description" && value.length > 0) {
          description = value;
        }
      }
    }

    const title = content.match(H1_PATTERN)?.[1]?.trim() ?? null;
    return {
      name: name ?? title ?? fallbackName,
      description,
      title,
    };
  } catch {
    return {
      name: fallbackName,
      description: "",
      title: null,
    };
  }
};

const listSkillDefinitionFiles = (skillsRoot: string): string[] => {
  if (!existsSync(skillsRoot)) return [];

  const definitions: string[] = [];

  let entries: string[] = [];
  try {
    entries = readdirSync(skillsRoot);
  } catch {
    return definitions;
  }

  for (const entry of entries) {
    const entryPath = join(skillsRoot, entry);
    try {
      if (!statSync(entryPath).isDirectory()) continue;
    } catch {
      continue;
    }

    const skillFile = join(entryPath, "SKILL.md");
    if (existsSync(skillFile)) {
      definitions.push(skillFile);
    }
  }

  return definitions;
};

export const readAvailableAgentSkills = (workspaceCwd: string): DeckAvailableSkill[] => {
  const roots: Array<{ path: string; source: DeckAvailableSkill["source"] }> = [
    { path: join(workspaceCwd, ".codex", "skills"), source: "project" },
    { path: join(workspaceCwd, ".claude", "skills"), source: "project" },
    { path: join(workspaceCwd, ".opencode", "skills"), source: "project" },
  ];

  const seen = new Map<string, DeckAvailableSkill>();

  for (const root of roots) {
    const definitions = listSkillDefinitionFiles(root.path);
    for (const definition of definitions) {
      const metadata = readSkillMetadata(definition);
      const name = metadata.name.trim();
      if (name.length === 0 || seen.has(name)) continue;
      seen.set(name, {
        name,
        description: metadata.description,
        source: root.source,
      });
    }
  }

  return [...seen.values()].sort((a, b) => {
    if (a.source !== b.source) {
      return a.source === "project" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
};

export const parseSuggestedSkillsFromContext = (content: string): string[] => {
  for (const { start, end } of SKILL_MARKERS) {
    const blockStart = content.indexOf(start);
    const blockEnd = content.indexOf(end);
    if (blockStart >= 0 && blockEnd > blockStart) {
      const block = content.slice(blockStart, blockEnd);
      const skills = block
        .split("\n")
        .map((line) => {
          const match = line.trim().match(/^- `(.+)`$/);
          return match?.[1]?.trim() ?? null;
        })
        .filter((skill): skill is string => skill !== null);

      return normalizeSkillNames(skills);
    }
  }
  return [];
};

const PRIMARY_SKILL_MARKER_START = SKILL_MARKERS[0].start;
const PRIMARY_SKILL_MARKER_END = SKILL_MARKERS[0].end;

const renderSuggestedSkillsBlock = (skills: readonly string[]): string => {
  const normalized = normalizeSkillNames(skills);
  if (normalized.length === 0) return "";

  const items = normalized.map((skill) => `- \`${skill}\``).join("\n");
  return [
    PRIMARY_SKILL_MARKER_START,
    "## Suggested Skills",
    "",
    "You can use these skills if you need to.",
    "",
    items,
    PRIMARY_SKILL_MARKER_END,
  ].join("\n");
};

export const applySuggestedSkillsToContext = (
  content: string,
  skills: readonly string[],
): string => {
  const trimmedContent = content.trimEnd();
  let withoutExistingBlock = trimmedContent;
  for (const { start, end } of SKILL_MARKERS) {
    const blockStart = withoutExistingBlock.indexOf(start);
    const blockEnd = withoutExistingBlock.indexOf(end);
    if (blockStart >= 0 && blockEnd > blockStart) {
      withoutExistingBlock =
        `${withoutExistingBlock.slice(0, blockStart).trimEnd()}\n${withoutExistingBlock
          .slice(blockEnd + end.length)
          .trimStart()}`.trimEnd();
    }
  }
  const block = renderSuggestedSkillsBlock(skills);

  if (block.length === 0) {
    return `${withoutExistingBlock}\n`;
  }

  const base = withoutExistingBlock.length > 0 ? `${withoutExistingBlock}\n\n` : "";
  return `${base}${block}\n`;
};
