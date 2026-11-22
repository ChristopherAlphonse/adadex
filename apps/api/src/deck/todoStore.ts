import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  COORDINATIONS_DIR_SEGMENT,
  WORKSPACE_RUNTIME_DIR,
  asRecord,
  isBoolean,
  isString,
} from "@adadex/core";

const COORDINATIONS_DIR = join(WORKSPACE_RUNTIME_DIR, COORDINATIONS_DIR_SEGMENT);

export type TodoProgressItem = { text: string; done: boolean };

export type TodoProgress = {
  total: number;
  done: number;
  items: TodoProgressItem[];
};

const TODOS_FILE = "todos.json";

export const LEGACY_TODO_FILE = "todo.md";

const summarize = (items: TodoProgressItem[]): TodoProgress => ({
  total: items.length,
  done: items.filter((item) => item.done).length,
  items,
});

const isSafeCoordinationId = (coordinationId: string): boolean =>
  coordinationId.length > 0 &&
  !coordinationId.includes("..") &&
  !coordinationId.includes("/") &&
  !coordinationId.includes("\\");

/** Reads the checkbox lines of a pre-todos.json `todo.md`, so existing coordinations keep their todos. */
const parseLegacyTodoMarkdown = (content: string): TodoProgressItem[] => {
  const items: TodoProgressItem[] = [];

  for (const line of content.split("\n")) {
    const match = line.trim().match(/^- \[([ xX])\]\s+(.+)/);

    if (match) {
      items.push({ text: match[2] ?? "", done: match[1] !== " " });
    }
  }

  return items;
};

const parseTodosJson = (raw: string): TodoProgressItem[] | null => {
  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) return null;

    const items: TodoProgressItem[] = [];

    for (const entry of parsed) {
      const record = asRecord(entry);

      if (!record || !isString(record.text) || !isBoolean(record.done)) return null;

      items.push({ text: record.text, done: record.done });
    }

    return items;
  } catch {
    return null;
  }
};

const todosPath = (workspaceCwd: string, coordinationId: string): string =>
  join(workspaceCwd, COORDINATIONS_DIR, coordinationId, TODOS_FILE);

const writeTodos = (
  workspaceCwd: string,
  coordinationId: string,
  items: TodoProgressItem[],
): TodoProgress | null => {
  try {
    writeFileSync(
      todosPath(workspaceCwd, coordinationId),
      `${JSON.stringify(items, null, 2)}\n`,
      "utf-8",
    );
  } catch {
    return null;
  }

  return summarize(items);
};

/**
 * The todos of one coordination, or null when it does not exist. Todos live in `todos.json`; a coordination that
 * only has a legacy `todo.md` is migrated on first read, and the markdown file is left untouched.
 */
export const readTodoProgress = (
  workspaceCwd: string,
  coordinationId: string,
): TodoProgress | null => {
  if (!isSafeCoordinationId(coordinationId)) return null;

  const coordinationDir = join(workspaceCwd, COORDINATIONS_DIR, coordinationId);

  if (!existsSync(coordinationDir)) return null;

  const jsonPath = todosPath(workspaceCwd, coordinationId);

  if (existsSync(jsonPath)) {
    try {
      const items = parseTodosJson(readFileSync(jsonPath, "utf-8"));

      return summarize(items ?? []);
    } catch {
      return summarize([]);
    }
  }

  const legacyPath = join(coordinationDir, LEGACY_TODO_FILE);

  if (!existsSync(legacyPath)) return summarize([]);

  try {
    const items = parseLegacyTodoMarkdown(readFileSync(legacyPath, "utf-8"));

    return writeTodos(workspaceCwd, coordinationId, items) ?? summarize(items);
  } catch {
    return summarize([]);
  }
};

const updateTodos = (
  workspaceCwd: string,
  coordinationId: string,
  update: (items: TodoProgressItem[]) => TodoProgressItem[] | null,
): TodoProgress | null => {
  const current = readTodoProgress(workspaceCwd, coordinationId);

  if (!current) return null;

  const next = update([...current.items]);

  return next ? writeTodos(workspaceCwd, coordinationId, next) : null;
};

export const toggleTodoItem = (
  workspaceCwd: string,
  coordinationId: string,
  itemIndex: number,
  done: boolean,
): TodoProgress | null =>
  updateTodos(workspaceCwd, coordinationId, (items) => {
    const item = items[itemIndex];

    if (!item) return null;

    items[itemIndex] = { ...item, done };

    return items;
  });

export const editTodoItem = (
  workspaceCwd: string,
  coordinationId: string,
  itemIndex: number,
  text: string,
): TodoProgress | null =>
  updateTodos(workspaceCwd, coordinationId, (items) => {
    const item = items[itemIndex];

    if (!item) return null;

    items[itemIndex] = { ...item, text };

    return items;
  });

export const addTodoItem = (
  workspaceCwd: string,
  coordinationId: string,
  text: string,
): TodoProgress | null =>
  updateTodos(workspaceCwd, coordinationId, (items) => [...items, { text, done: false }]);

export const deleteTodoItem = (
  workspaceCwd: string,
  coordinationId: string,
  itemIndex: number,
): TodoProgress | null =>
  updateTodos(workspaceCwd, coordinationId, (items) =>
    itemIndex >= 0 && itemIndex < items.length
      ? items.filter((_, index) => index !== itemIndex)
      : null,
  );

/** Creates an empty todo list for a new coordination. */
export const initTodos = (workspaceCwd: string, coordinationId: string): void => {
  writeTodos(workspaceCwd, coordinationId, []);
};
