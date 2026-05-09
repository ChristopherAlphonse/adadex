import { createHash, randomUUID } from "node:crypto";
import {
  appendFileSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

import {
  COORDINATIONS_DIR_SEGMENT,
  GLOBAL_RUNTIME_DIR_NAME,
  LEGACY_COORDINATIONS_DIR_SEGMENT,
  LEGACY_GLOBAL_RUNTIME_DIR_NAME,
  LEGACY_TERMINAL_REGISTRY_FILENAME,
  LEGACY_WORKSPACE_RUNTIME_DIR,
  TERMINAL_REGISTRY_FILENAME,
  WORKSPACE_RUNTIME_DIR,
} from "@adadex/core";

export const GLOBAL_ADADEX_DIR = join(homedir(), GLOBAL_RUNTIME_DIR_NAME);
/** @deprecated Use GLOBAL_ADADEX_DIR */
export const GLOBAL_OCTOGENT_DIR = GLOBAL_ADADEX_DIR;
export const PROJECTS_FILE = join(GLOBAL_ADADEX_DIR, "projects.json");
export const PROJECT_CONFIG_RELATIVE_PATH = join(WORKSPACE_RUNTIME_DIR, "project.json");

type ProjectConfigDocument = {
  version: 1;
  projectId: string;
  displayName: string;
  createdAt: string;
};

export type ProjectRegistryEntry = {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  lastOpenedAt?: string;
};

type LegacyProjectRegistryEntry = {
  name?: unknown;
  path?: unknown;
  createdAt?: unknown;
};

export type ProjectsRegistry = { projects: ProjectRegistryEntry[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const toProjectRegistryEntry = (
  value: unknown,
  workspaceCwd?: string,
): ProjectRegistryEntry | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id === "string" &&
    value.id.trim().length > 0 &&
    typeof value.name === "string" &&
    value.name.trim().length > 0 &&
    typeof value.path === "string" &&
    value.path.trim().length > 0 &&
    typeof value.createdAt === "string" &&
    value.createdAt.trim().length > 0
  ) {
    return {
      id: value.id,
      name: value.name,
      path: value.path,
      createdAt: value.createdAt,
      ...(typeof value.lastOpenedAt === "string" && value.lastOpenedAt.trim().length > 0
        ? { lastOpenedAt: value.lastOpenedAt }
        : {}),
    };
  }

  if (
    workspaceCwd &&
    typeof value.name === "string" &&
    value.name.trim().length > 0 &&
    typeof value.path === "string" &&
    value.path === workspaceCwd
  ) {
    return {
      id: `legacy-${randomUUID()}`,
      name: value.name,
      path: value.path,
      createdAt:
        typeof value.createdAt === "string" && value.createdAt.trim().length > 0
          ? value.createdAt
          : new Date().toISOString(),
    };
  }

  return null;
};

const toProjectConfigDocument = (value: unknown): ProjectConfigDocument | null => {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.projectId !== "string" ||
    value.projectId.trim().length === 0 ||
    typeof value.displayName !== "string" ||
    value.displayName.trim().length === 0 ||
    typeof value.createdAt !== "string" ||
    value.createdAt.trim().length === 0
  ) {
    return null;
  }

  return {
    version: 1,
    projectId: value.projectId,
    displayName: value.displayName,
    createdAt: value.createdAt,
  };
};

const readJsonFile = (filePath: string): unknown | null => {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  } catch {
    return null;
  }
};

export const migrateLegacyGlobalLayout = (): void => {
  const home = homedir();
  const legacy = join(home, LEGACY_GLOBAL_RUNTIME_DIR_NAME);
  const next = join(home, GLOBAL_RUNTIME_DIR_NAME);
  if (existsSync(legacy) && !existsSync(next)) {
    try {
      renameSync(legacy, next);
      console.log(
        `[adadex] Migrated global directory ${LEGACY_GLOBAL_RUNTIME_DIR_NAME} → ${GLOBAL_RUNTIME_DIR_NAME}`,
      );
    } catch (error) {
      console.warn("[adadex] Could not migrate global config directory:", error);
    }
  }
};

/** Rename `.octogent` → `.adadex` and `orchestrations` → `coordinations` when present. */
export const migrateLegacyWorkspaceLayout = (workspaceCwd: string): void => {
  const legacyRoot = join(workspaceCwd, LEGACY_WORKSPACE_RUNTIME_DIR);
  const nextRoot = join(workspaceCwd, WORKSPACE_RUNTIME_DIR);
  if (existsSync(legacyRoot) && !existsSync(nextRoot)) {
    try {
      renameSync(legacyRoot, nextRoot);
      console.log(
        `[adadex] Migrated workspace ${LEGACY_WORKSPACE_RUNTIME_DIR} → ${WORKSPACE_RUNTIME_DIR}`,
      );
    } catch (error) {
      console.warn("[adadex] Could not migrate workspace runtime directory:", error);
      return;
    }
  }
  const root = existsSync(nextRoot) ? nextRoot : legacyRoot;
  if (!existsSync(root)) {
    return;
  }
  const legacyCoord = join(root, LEGACY_COORDINATIONS_DIR_SEGMENT);
  const nextCoord = join(root, COORDINATIONS_DIR_SEGMENT);
  if (existsSync(legacyCoord) && !existsSync(nextCoord)) {
    try {
      renameSync(legacyCoord, nextCoord);
    } catch (error) {
      console.warn("[adadex] Could not migrate coordinations folder:", error);
    }
  }
  const stateDir = join(root, "state");
  if (existsSync(stateDir)) {
    const prevReg = join(stateDir, LEGACY_TERMINAL_REGISTRY_FILENAME);
    const newReg = join(stateDir, TERMINAL_REGISTRY_FILENAME);
    if (existsSync(prevReg) && !existsSync(newReg)) {
      try {
        renameSync(prevReg, newReg);
      } catch (error) {
        console.warn("[adadex] Could not rename terminal registry file:", error);
      }
    }
  }
};

export const ensureGlobalAdadexDir = () => {
  migrateLegacyGlobalLayout();
  if (!existsSync(GLOBAL_ADADEX_DIR)) {
    mkdirSync(GLOBAL_ADADEX_DIR, { recursive: true });
  }
};

/** @deprecated Use ensureGlobalAdadexDir */
export const ensureGlobalOctogentDir = ensureGlobalAdadexDir;

export const loadProjectsRegistry = (): ProjectsRegistry => {
  ensureGlobalOctogentDir();

  if (!existsSync(PROJECTS_FILE)) {
    return { projects: [] };
  }

  const parsed = readJsonFile(PROJECTS_FILE);
  if (!isRecord(parsed) || !Array.isArray(parsed.projects)) {
    return { projects: [] };
  }

  return {
    projects: parsed.projects
      .map((entry) => toProjectRegistryEntry(entry))
      .filter((entry): entry is ProjectRegistryEntry => entry !== null),
  };
};

export const saveProjectsRegistry = (registry: ProjectsRegistry) => {
  ensureGlobalOctogentDir();
  writeFileSync(PROJECTS_FILE, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
};

export const resolveProjectConfigPath = (workspaceCwd: string) =>
  join(workspaceCwd, PROJECT_CONFIG_RELATIVE_PATH);

export const deriveProjectIdFromWorkspace = (workspaceCwd: string) =>
  `workspace-${createHash("sha1").update(workspaceCwd).digest("hex").slice(0, 16)}`;

const inferLegacyProjectName = (workspaceCwd: string): string | null => {
  const parsed = readJsonFile(PROJECTS_FILE);
  if (!isRecord(parsed) || !Array.isArray(parsed.projects)) {
    return null;
  }

  for (const legacyEntry of parsed.projects as LegacyProjectRegistryEntry[]) {
    if (legacyEntry.path === workspaceCwd && typeof legacyEntry.name === "string") {
      return legacyEntry.name;
    }
  }

  return null;
};

export const loadProjectConfig = (workspaceCwd: string): ProjectConfigDocument | null => {
  const configPath = resolveProjectConfigPath(workspaceCwd);
  if (!existsSync(configPath)) {
    return null;
  }

  return toProjectConfigDocument(readJsonFile(configPath));
};

export const ensureProjectConfig = (
  workspaceCwd: string,
  preferredName?: string,
  preferredProjectId?: string,
): ProjectConfigDocument => {
  const existing = loadProjectConfig(workspaceCwd);
  if (existing) {
    return existing;
  }

  const displayName =
    preferredName?.trim() ||
    inferLegacyProjectName(workspaceCwd) ||
    basename(workspaceCwd) ||
    "adadex-project";
  const config: ProjectConfigDocument = {
    version: 1,
    projectId: preferredProjectId?.trim() || randomUUID(),
    displayName,
    createdAt: new Date().toISOString(),
  };

  const configPath = resolveProjectConfigPath(workspaceCwd);
  mkdirSync(join(workspaceCwd, WORKSPACE_RUNTIME_DIR), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return config;
};

export const registerProject = (
  workspaceCwd: string,
  preferredName?: string,
): ProjectRegistryEntry => {
  const projectConfig = ensureProjectConfig(workspaceCwd, preferredName);
  const registry = loadProjectsRegistry();
  const lastOpenedAt = new Date().toISOString();
  const existing = registry.projects.find((entry) => entry.id === projectConfig.projectId);

  if (existing) {
    existing.name = projectConfig.displayName;
    existing.path = workspaceCwd;
    existing.lastOpenedAt = lastOpenedAt;
    saveProjectsRegistry(registry);
    return existing;
  }

  const nextEntry: ProjectRegistryEntry = {
    id: projectConfig.projectId,
    name: projectConfig.displayName,
    path: workspaceCwd,
    createdAt: projectConfig.createdAt,
    lastOpenedAt,
  };

  const filteredProjects = registry.projects.filter(
    (entry) => entry.path !== workspaceCwd && entry.id !== projectConfig.projectId,
  );
  filteredProjects.push(nextEntry);
  saveProjectsRegistry({ projects: filteredProjects });
  return nextEntry;
};

export const resolveGlobalProjectDir = (projectId: string) =>
  join(GLOBAL_ADADEX_DIR, "projects", projectId);

export const resolveEphemeralProjectStateDir = (workspaceCwd: string) =>
  resolveGlobalProjectDir(deriveProjectIdFromWorkspace(workspaceCwd));

export const resolveProjectStateDir = (workspaceCwd: string, preferredName?: string): string => {
  const entry = registerProject(workspaceCwd, preferredName);
  const projectDir = resolveGlobalProjectDir(entry.id);
  mkdirSync(join(projectDir, "state"), { recursive: true });
  return projectDir;
};

export const ensureProjectScaffold = (
  workspaceCwd: string,
  preferredName?: string,
  preferredProjectId?: string,
) => {
  const runtimeDir = join(workspaceCwd, WORKSPACE_RUNTIME_DIR);
  for (const subdirectory of [COORDINATIONS_DIR_SEGMENT, "worktrees"]) {
    mkdirSync(join(runtimeDir, subdirectory), { recursive: true });
  }

  return ensureProjectConfig(workspaceCwd, preferredName, preferredProjectId);
};

export const hasAdadexGitignoreEntry = (workspaceCwd: string) => {
  const gitignorePath = join(workspaceCwd, ".gitignore");
  if (!existsSync(gitignorePath)) {
    return false;
  }

  const content = readFileSync(gitignorePath, "utf-8");
  const lines = content.split("\n").map((line) => line.trim());
  const hasRuntimeEntry =
    lines.includes(WORKSPACE_RUNTIME_DIR) ||
    lines.includes(`${WORKSPACE_RUNTIME_DIR}/`) ||
    lines.includes(LEGACY_WORKSPACE_RUNTIME_DIR) ||
    lines.includes(`${LEGACY_WORKSPACE_RUNTIME_DIR}/`);
  return hasRuntimeEntry && lines.includes(".planning/");
};

export const ensureAdadexGitignoreEntry = (workspaceCwd: string) => {
  const gitignorePath = join(workspaceCwd, ".gitignore");
  const requiredEntries = [`${WORKSPACE_RUNTIME_DIR}/`, ".planning/"];

  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, "utf-8");
    const lines = content.split("\n").map((line) => line.trim());
    const missingEntries = requiredEntries.filter((entry) => !lines.includes(entry));

    if (missingEntries.length === 0) {
      return { changed: false };
    }

    appendFileSync(gitignorePath, `\n${missingEntries.join("\n")}\n`, "utf-8");
    return { changed: true };
  }

  writeFileSync(gitignorePath, `${requiredEntries.join("\n")}\n`, "utf-8");
  return { changed: true };
};

/** @deprecated */
export const hasOctogentGitignoreEntry = hasAdadexGitignoreEntry;
/** @deprecated */
export const ensureOctogentGitignoreEntry = ensureAdadexGitignoreEntry;

export const migrateStateToGlobal = (workspaceCwd: string, projectStateDir: string) => {
  const legacyLocalRoot = join(workspaceCwd, LEGACY_WORKSPACE_RUNTIME_DIR);
  const newLocalRoot = join(workspaceCwd, WORKSPACE_RUNTIME_DIR);
  if (projectStateDir === legacyLocalRoot || projectStateDir === newLocalRoot) {
    return;
  }

  const currentConfig = loadProjectConfig(workspaceCwd);
  const legacyProjectName = inferLegacyProjectName(workspaceCwd);
  const legacyGlobalProjectDir =
    legacyProjectName && currentConfig
      ? join(GLOBAL_ADADEX_DIR, "projects", legacyProjectName)
      : null;

  const oldStateDir =
    [join(legacyLocalRoot, "state"), join(newLocalRoot, "state")].find((candidate) =>
      existsSync(candidate),
    ) ?? join(legacyLocalRoot, "state");

  const newStateDir = join(projectStateDir, "state");

  mkdirSync(newStateDir, { recursive: true });

  const copyStateFile = (fileName: string, legacyNames: string[]) => {
    const destination = join(newStateDir, fileName);
    if (existsSync(destination)) {
      return false;
    }

    for (const legacyFile of legacyNames) {
      const localSource = join(oldStateDir, legacyFile);
      if (existsSync(localSource)) {
        copyFileSync(localSource, destination);
        return true;
      }
    }

    if (!legacyGlobalProjectDir) {
      return false;
    }

    for (const legacyFile of legacyNames) {
      const legacySource = join(legacyGlobalProjectDir, "state", legacyFile);
      if (existsSync(legacySource)) {
        copyFileSync(legacySource, destination);
        return true;
      }
    }

    return false;
  };

  const stateFiles: { name: string; legacy: string[] }[] = [
    {
      name: TERMINAL_REGISTRY_FILENAME,
      legacy: [TERMINAL_REGISTRY_FILENAME, LEGACY_TERMINAL_REGISTRY_FILENAME],
    },
    { name: "deck.json", legacy: ["deck.json"] },
    { name: "monitor-config.json", legacy: ["monitor-config.json"] },
    { name: "monitor-cache.json", legacy: ["monitor-cache.json"] },
    { name: "code-intel-events.jsonl", legacy: ["code-intel-events.jsonl"] },
    { name: "runtime.json", legacy: ["runtime.json"] },
  ];

  let migrated = 0;
  for (const { name, legacy } of stateFiles) {
    if (copyStateFile(name, legacy)) {
      migrated += 1;
    }
  }

  const transcriptDestination = join(newStateDir, "transcripts");
  if (!existsSync(transcriptDestination)) {
    const localTranscriptSource = join(oldStateDir, "transcripts");
    if (existsSync(localTranscriptSource)) {
      cpSync(localTranscriptSource, transcriptDestination, { recursive: true });
      migrated += 1;
    } else if (legacyGlobalProjectDir) {
      const legacyTranscriptSource = join(legacyGlobalProjectDir, "state", "transcripts");
      if (existsSync(legacyTranscriptSource)) {
        cpSync(legacyTranscriptSource, transcriptDestination, { recursive: true });
        migrated += 1;
      }
    }
  }

  if (migrated > 0) {
    console.log(`  Migrated state to ${projectStateDir}`);
  }
};
