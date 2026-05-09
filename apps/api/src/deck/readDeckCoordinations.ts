import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import type {
  DeckAvailableSkill,
  DeckCoordinationStatus,
  DeckCoordinationSummary,
  DeckMascotAppearance,
} from "@adadex/core";
import {
  COORDINATIONS_DIR_SEGMENT,
  LEGACY_DECK_STATE_MAP_KEY,
  WORKSPACE_RUNTIME_DIR,
} from "@adadex/core";

import {
  applySuggestedSkillsToContext,
  parseSuggestedSkillsFromContext,
  readAvailableAgentSkills,
} from "../agentSkills";
import { markCoordinationsInitialized } from "../setupState";

const COORDINATIONS_DIR = join(WORKSPACE_RUNTIME_DIR, COORDINATIONS_DIR_SEGMENT);

const VALID_STATUSES: ReadonlySet<string> = new Set(["idle", "active", "blocked", "needs-review"]);

// ─── Deck state (app metadata, separate from agent-facing files) ────────────

type DeckCoordinationState = {
  color: string | null;
  status: DeckCoordinationStatus;
  mascot: DeckMascotAppearance;
  scope: { paths: string[]; tags: string[] };
};

type DeckStateDocument = {
  coordinations: Record<string, DeckCoordinationState>;
};

const readDeckState = (projectStateDir: string): DeckStateDocument => {
  const filePath = join(projectStateDir, "state", "deck.json");
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf-8")) as Record<string, unknown>;
    if (raw && typeof raw === "object") {
      const coordinations: Record<string, DeckCoordinationState> = {};
      const fromNew = raw.coordinations;
      const fromLegacy = raw[LEGACY_DECK_STATE_MAP_KEY];
      if (fromNew && typeof fromNew === "object" && fromNew !== null) {
        for (const [key, val] of Object.entries(fromNew)) {
          coordinations[key] = parseCoordinationState(val);
        }
      }
      if (fromLegacy && typeof fromLegacy === "object" && fromLegacy !== null) {
        for (const [key, val] of Object.entries(fromLegacy)) {
          if (!coordinations[key]) {
            coordinations[key] = parseCoordinationState(val);
          }
        }
      }
      return { coordinations };
    }
  } catch {
    // missing or corrupt — return empty
  }
  return { coordinations: {} };
};

const writeDeckState = (projectStateDir: string, state: DeckStateDocument): void => {
  const filePath = join(projectStateDir, "state", "deck.json");
  const dir = join(projectStateDir, "state");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`);
};

const parseCoordinationState = (raw: unknown): DeckCoordinationState => {
  const defaults: DeckCoordinationState = {
    color: null,
    status: "idle",
    mascot: { animation: null, expression: null, accessory: null, hairColor: null },
    scope: { paths: [], tags: [] },
  };

  if (raw === null || typeof raw !== "object") return defaults;
  const rec = raw as Record<string, unknown>;

  const color =
    typeof rec.color === "string" && rec.color.trim().length > 0 ? rec.color.trim() : null;
  const status =
    typeof rec.status === "string" && VALID_STATUSES.has(rec.status)
      ? (rec.status as DeckCoordinationStatus)
      : "idle";

  const mascot: DeckMascotAppearance = {
    animation: null,
    expression: null,
    accessory: null,
    hairColor: null,
  };
  const appearanceRaw =
    rec.mascot !== null && typeof rec.mascot === "object"
      ? (rec.mascot as Record<string, unknown>)
      : rec.octopus !== null && typeof rec.octopus === "object"
        ? (rec.octopus as Record<string, unknown>)
        : null;
  if (appearanceRaw !== null) {
    if (typeof appearanceRaw.animation === "string") mascot.animation = appearanceRaw.animation;
    if (typeof appearanceRaw.expression === "string") mascot.expression = appearanceRaw.expression;
    if (typeof appearanceRaw.accessory === "string") mascot.accessory = appearanceRaw.accessory;
    if (typeof appearanceRaw.hairColor === "string") mascot.hairColor = appearanceRaw.hairColor;
  }

  const scope = { paths: [] as string[], tags: [] as string[] };
  if (rec.scope !== null && typeof rec.scope === "object") {
    const s = rec.scope as Record<string, unknown>;
    if (Array.isArray(s.paths)) {
      scope.paths = s.paths.filter((p): p is string => typeof p === "string");
    }
    if (Array.isArray(s.tags)) {
      scope.tags = s.tags.filter((t): t is string => typeof t === "string");
    }
  }

  return { color, status, mascot, scope };
};

// ─── Parse CONTEXT.md for title and description ───────────────────────────────

const parseContextMd = (
  content: string,
): { displayName: string; description: string; suggestedSkills: string[] } | null => {
  const lines = content.split("\n");
  let displayName: string | null = null;
  let description = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!displayName) {
      const h1Match = trimmed.match(/^#\s+(.+)/);
      if (h1Match) {
        displayName = (h1Match[1] as string).trim();
      }
      continue;
    }
    // First non-empty line after the H1 is the description
    if (trimmed.length > 0) {
      description = trimmed;
      break;
    }
  }

  if (!displayName) return null;
  return { displayName, description, suggestedSkills: parseSuggestedSkillsFromContext(content) };
};

// ─── Todo parsing ───────────────────────────────────────────────────────────

export const parseTodoProgress = (
  content: string,
): { total: number; done: number; items: { text: string; done: boolean }[] } => {
  const lines = content.split("\n");
  let total = 0;
  let done = 0;
  const items: { text: string; done: boolean }[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const checkedMatch = trimmed.match(/^- \[x\]\s+(.+)/i);
    const uncheckedMatch = trimmed.match(/^- \[ \]\s+(.+)/);

    if (checkedMatch) {
      total++;
      done++;
      items.push({ text: checkedMatch[1] as string, done: true });
    } else if (uncheckedMatch) {
      total++;
      items.push({ text: uncheckedMatch[1] as string, done: false });
    }
  }

  return { total, done, items };
};

// ─── Read all deck coordinations ───────────────────────────────────────────

export const readDeckCoordinations = (
  workspaceCwd: string,
  projectStateDir?: string,
): DeckCoordinationSummary[] => {
  const coordinationsRoot = join(workspaceCwd, COORDINATIONS_DIR);
  if (!existsSync(coordinationsRoot)) return [];

  let entries: string[];
  try {
    entries = readdirSync(coordinationsRoot);
  } catch {
    return [];
  }

  const deckState = readDeckState(projectStateDir ?? join(workspaceCwd, WORKSPACE_RUNTIME_DIR));
  const results: DeckCoordinationSummary[] = [];

  for (const entry of entries) {
    const entryPath = join(coordinationsRoot, entry);
    if (!statSync(entryPath).isDirectory()) continue;

    // A coordination folder must have CONTEXT.md
    const contextMdPath = join(entryPath, "CONTEXT.md");
    if (!existsSync(contextMdPath)) continue;

    let agentInfo: { displayName: string; description: string; suggestedSkills: string[] };
    try {
      const content = readFileSync(contextMdPath, "utf-8");
      const parsed = parseContextMd(content);
      if (!parsed) continue;
      agentInfo = parsed;
    } catch {
      continue;
    }

    // App metadata from deck state
    const state = parseCoordinationState(deckState.coordinations[entry]);

    // List markdown files in the coordination folder (excluding CONTEXT.md itself)
    let vaultFiles: string[] = [];
    try {
      vaultFiles = readdirSync(entryPath)
        .filter((f) => f.endsWith(".md") && f !== "CONTEXT.md")
        .sort((a, b) => {
          if (a === "todo.md") return -1;
          if (b === "todo.md") return 1;
          return a.localeCompare(b);
        });
    } catch {
      // skip unreadable dirs
    }

    // Parse todo.md for progress
    let todoTotal = 0;
    let todoDone = 0;
    let todoItems: { text: string; done: boolean }[] = [];
    const todoPath = join(entryPath, "todo.md");
    if (existsSync(todoPath)) {
      try {
        const todoContent = readFileSync(todoPath, "utf-8");
        const progress = parseTodoProgress(todoContent);
        todoTotal = progress.total;
        todoDone = progress.done;
        todoItems = progress.items;
      } catch {
        // skip unreadable todo
      }
    }

    results.push({
      coordinationId: entry,
      displayName: agentInfo.displayName,
      description: agentInfo.description,
      status: state.status,
      color: state.color,
      mascot: state.mascot,
      scope: state.scope,
      vaultFiles,
      todoTotal,
      todoDone,
      todoItems,
      suggestedSkills: agentInfo.suggestedSkills,
    });
  }

  return results;
};

// ─── Read a vault file from a coordination ─────────────────────────────────

export const readDeckVaultFile = (
  workspaceCwd: string,
  coordinationId: string,
  fileName: string,
): string | null => {
  // Prevent path traversal
  if (coordinationId.includes("..") || coordinationId.includes("/")) return null;
  if (fileName.includes("..") || fileName.includes("/")) return null;

  const filePath = join(workspaceCwd, COORDINATIONS_DIR, coordinationId, fileName);

  if (!existsSync(filePath)) return null;

  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
};

/**
 * Toggle a todo checkbox in a coordination's todo.md by item index.
 */
export const toggleTodoItem = (
  workspaceCwd: string,
  coordinationId: string,
  itemIndex: number,
  done: boolean,
): { total: number; done: number; items: { text: string; done: boolean }[] } | null => {
  if (coordinationId.includes("..") || coordinationId.includes("/")) return null;

  const filePath = join(workspaceCwd, COORDINATIONS_DIR, coordinationId, "todo.md");
  if (!existsSync(filePath)) return null;

  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }

  const lines = content.split("\n");
  let todoIndex = 0;
  let toggled = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = (lines[i] as string).trim();
    if (/^- \[[ xX]\]\s+/.test(trimmed)) {
      if (todoIndex === itemIndex) {
        lines[i] = done
          ? (lines[i] as string).replace(/- \[ \]/, "- [x]")
          : (lines[i] as string).replace(/- \[[xX]\]/, "- [ ]");
        toggled = true;
        break;
      }
      todoIndex++;
    }
  }

  if (!toggled) return null;

  const updated = lines.join("\n");
  try {
    writeFileSync(filePath, updated, "utf-8");
  } catch {
    return null;
  }

  return parseTodoProgress(updated);
};

/**
 * Edit the text of a todo item in a coordination's todo.md by item index.
 */
export const editTodoItem = (
  workspaceCwd: string,
  coordinationId: string,
  itemIndex: number,
  text: string,
): { total: number; done: number; items: { text: string; done: boolean }[] } | null => {
  if (coordinationId.includes("..") || coordinationId.includes("/")) return null;

  const filePath = join(workspaceCwd, COORDINATIONS_DIR, coordinationId, "todo.md");
  if (!existsSync(filePath)) return null;

  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }

  const lines = content.split("\n");
  let todoIndex = 0;
  let edited = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = (lines[i] as string).trim();
    const match = trimmed.match(/^(- \[[ xX]\])\s+(.+)/);
    if (match) {
      if (todoIndex === itemIndex) {
        const indent = (lines[i] as string).match(/^(\s*)/)?.[1] ?? "";
        lines[i] = `${indent}${match[1]} ${text}`;
        edited = true;
        break;
      }
      todoIndex++;
    }
  }

  if (!edited) return null;

  const updated = lines.join("\n");
  try {
    writeFileSync(filePath, updated, "utf-8");
  } catch {
    return null;
  }

  return parseTodoProgress(updated);
};

/**
 * Add a new todo item to a coordination's todo.md.
 */
export const addTodoItem = (
  workspaceCwd: string,
  coordinationId: string,
  text: string,
): { total: number; done: number; items: { text: string; done: boolean }[] } | null => {
  if (coordinationId.includes("..") || coordinationId.includes("/")) return null;

  const filePath = join(workspaceCwd, COORDINATIONS_DIR, coordinationId, "todo.md");
  if (!existsSync(filePath)) return null;

  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }

  const trimmed = content.endsWith("\n") ? content : `${content}\n`;
  const updated = `${trimmed}- [ ] ${text}\n`;

  try {
    writeFileSync(filePath, updated, "utf-8");
  } catch {
    return null;
  }

  return parseTodoProgress(updated);
};

/**
 * Delete a todo item from a coordination's todo.md by item index.
 */
export const deleteTodoItem = (
  workspaceCwd: string,
  coordinationId: string,
  itemIndex: number,
): { total: number; done: number; items: { text: string; done: boolean }[] } | null => {
  if (coordinationId.includes("..") || coordinationId.includes("/")) return null;

  const filePath = join(workspaceCwd, COORDINATIONS_DIR, coordinationId, "todo.md");
  if (!existsSync(filePath)) return null;

  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }

  const lines = content.split("\n");
  let todoIndex = 0;
  let deleted = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = (lines[i] as string).trim();
    if (/^- \[[ xX]\]\s+/.test(trimmed)) {
      if (todoIndex === itemIndex) {
        lines.splice(i, 1);
        deleted = true;
        break;
      }
      todoIndex++;
    }
  }

  if (!deleted) return null;

  const updated = lines.join("\n");
  try {
    writeFileSync(filePath, updated, "utf-8");
  } catch {
    return null;
  }

  return parseTodoProgress(updated);
};

// ─── Create a new deck coordination ────────────────────────────────────────

type CreateDeckCoordinationInput = {
  name: string;
  description: string;
  color: string;
  mascot: DeckMascotAppearance;
  suggestedSkills?: string[];
};

type CreateDeckCoordinationResult =
  | { ok: true; coordination: DeckCoordinationSummary }
  | { ok: false; error: string };

export const createDeckCoordination = (
  workspaceCwd: string,
  input: CreateDeckCoordinationInput,
  projectStateDir?: string,
): CreateDeckCoordinationResult => {
  const stateDir = projectStateDir ?? join(workspaceCwd, WORKSPACE_RUNTIME_DIR);
  const name = input.name.trim();
  if (name.length === 0) {
    return { ok: false, error: "Name is required" };
  }
  if (name.includes("..") || name.includes("/")) {
    return { ok: false, error: "Name contains invalid characters" };
  }

  const coordinationDir = join(workspaceCwd, COORDINATIONS_DIR, name);
  if (existsSync(coordinationDir)) {
    return { ok: false, error: "A coordination with this name already exists" };
  }

  // Create the coordination folder with agent-facing files
  mkdirSync(coordinationDir, { recursive: true });

  const description = input.description.trim();
  const baseContextMd = description.length > 0 ? `# ${name}\n\n${description}\n` : `# ${name}\n`;
  const suggestedSkills = [...new Set((input.suggestedSkills ?? []).map((skill) => skill.trim()))]
    .filter((skill) => skill.length > 0)
    .sort((a, b) => a.localeCompare(b));
  const contextMd = applySuggestedSkillsToContext(baseContextMd, suggestedSkills);
  writeFileSync(join(coordinationDir, "CONTEXT.md"), contextMd);
  writeFileSync(join(coordinationDir, "todo.md"), "# Todo\n");

  // Persist app metadata in deck state
  const deckState = readDeckState(stateDir);
  deckState.coordinations[name] = {
    color: input.color,
    status: "idle",
    mascot: input.mascot,
    scope: { paths: [], tags: [] },
  };
  writeDeckState(stateDir, deckState);
  markCoordinationsInitialized(stateDir);

  return {
    ok: true,
    coordination: {
      coordinationId: name,
      displayName: name,
      description,
      status: "idle",
      color: input.color,
      mascot: input.mascot,
      scope: { paths: [], tags: [] },
      vaultFiles: [],
      todoTotal: 0,
      todoDone: 0,
      todoItems: [],
      suggestedSkills,
    },
  };
};

export const listDeckAvailableSkills = (workspaceCwd: string): DeckAvailableSkill[] =>
  readAvailableAgentSkills(workspaceCwd);

export const updateDeckCoordinationSuggestedSkills = (
  workspaceCwd: string,
  coordinationId: string,
  suggestedSkills: string[],
  projectStateDir?: string,
): DeckCoordinationSummary | null => {
  if (coordinationId.includes("..") || coordinationId.includes("/")) return null;

  const contextPath = join(workspaceCwd, COORDINATIONS_DIR, coordinationId, "CONTEXT.md");
  if (!existsSync(contextPath)) return null;

  try {
    const existing = readFileSync(contextPath, "utf8");
    const updated = applySuggestedSkillsToContext(existing, suggestedSkills);
    writeFileSync(contextPath, updated, "utf8");
  } catch {
    return null;
  }

  return (
    readDeckCoordinations(workspaceCwd, projectStateDir).find(
      (c) => c.coordinationId === coordinationId,
    ) ?? null
  );
};

// ─── Delete a coordination ─────────────────────────────────────────────────

export const deleteDeckCoordination = (
  workspaceCwd: string,
  coordinationId: string,
  projectStateDir?: string,
): { ok: true } | { ok: false; error: string } => {
  const stateDir = projectStateDir ?? join(workspaceCwd, WORKSPACE_RUNTIME_DIR);
  if (coordinationId.includes("..") || coordinationId.includes("/")) {
    return { ok: false, error: "Invalid coordination ID" };
  }

  const coordinationDir = join(workspaceCwd, COORDINATIONS_DIR, coordinationId);
  if (!existsSync(coordinationDir)) {
    return { ok: false, error: "Coordination not found" };
  }

  rmSync(coordinationDir, { recursive: true, force: true });

  // Remove from deck state
  const deckState = readDeckState(stateDir);
  delete deckState.coordinations[coordinationId];
  writeDeckState(stateDir, deckState);

  return { ok: true };
};
