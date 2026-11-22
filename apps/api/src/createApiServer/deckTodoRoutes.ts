import { asRecord, isBoolean, isNumber, isString } from "@adadex/core";

import {
  addTodoItem,
  deleteTodoItem,
  editTodoItem,
  parseTodoProgress,
  readDeckCoordinations,
  readDeckVaultFile,
  toggleTodoItem,
} from "../deck/readDeckCoordinations";
import {} from "../deck/swarmPrompts";
import { RuntimeInputError } from "../terminalRuntime";
import { buildSingleTodoWorkerPrompt, type DeckTerminalCreateInput } from "./deckRouteShared";
import type { ApiRouteHandler } from "./routeHelpers";
import { readJsonBodyOrWriteError, writeJson, writeMethodNotAllowed } from "./routeHelpers";
import { parseTerminalAgentProvider } from "./terminalParsers";

const DECK_TODO_TOGGLE_PATTERN = /^\/api\/deck\/coordinations\/([^/]+)\/todo\/toggle$/;

export const handleDeckTodoToggleRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { workspaceCwd },
) => {
  const match = requestUrl.pathname.match(DECK_TODO_TOGGLE_PATTERN);

  if (!match) return false;

  if (request.method !== "PATCH") {
    writeMethodNotAllowed(response, corsOrigin);

    return true;
  }

  const body = await readJsonBodyOrWriteError(request, response, corsOrigin);

  if (!body.ok) return true;

  const payload = asRecord(body.payload);
  const itemIndex = payload?.itemIndex;
  const done = payload?.done;

  if (!isNumber(itemIndex) || !isBoolean(done)) {
    writeJson(
      response,
      400,
      { error: "itemIndex (number) and done (boolean) are required" },
      corsOrigin,
    );

    return true;
  }

  const coordinationId = decodeURIComponent(match[1] ?? "");
  const result = toggleTodoItem(workspaceCwd, coordinationId, itemIndex, done);

  if (!result) {
    writeJson(response, 404, { error: "Todo item not found" }, corsOrigin);

    return true;
  }

  writeJson(response, 200, result, corsOrigin);

  return true;
};

const DECK_TODO_EDIT_PATTERN = /^\/api\/deck\/coordinations\/([^/]+)\/todo\/edit$/;

export const handleDeckTodoEditRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { workspaceCwd },
) => {
  const match = requestUrl.pathname.match(DECK_TODO_EDIT_PATTERN);

  if (!match) return false;

  if (request.method !== "PATCH") {
    writeMethodNotAllowed(response, corsOrigin);

    return true;
  }

  const body = await readJsonBodyOrWriteError(request, response, corsOrigin);

  if (!body.ok) return true;

  const payload = asRecord(body.payload);
  const itemIndex = payload?.itemIndex;
  const text = payload?.text;

  if (!isNumber(itemIndex) || !isString(text) || text.trim().length === 0) {
    writeJson(
      response,
      400,
      { error: "itemIndex (number) and text (non-empty string) are required" },
      corsOrigin,
    );

    return true;
  }

  const coordinationId = decodeURIComponent(match[1] ?? "");
  const result = editTodoItem(workspaceCwd, coordinationId, itemIndex, text.trim());

  if (!result) {
    writeJson(response, 404, { error: "Todo item not found" }, corsOrigin);

    return true;
  }

  writeJson(response, 200, result, corsOrigin);

  return true;
};

const DECK_TODO_ADD_PATTERN = /^\/api\/deck\/coordinations\/([^/]+)\/todo$/;

export const handleDeckTodoAddRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { workspaceCwd },
) => {
  const match = requestUrl.pathname.match(DECK_TODO_ADD_PATTERN);

  if (!match) return false;

  if (request.method !== "POST") {
    writeMethodNotAllowed(response, corsOrigin);

    return true;
  }

  const body = await readJsonBodyOrWriteError(request, response, corsOrigin);

  if (!body.ok) return true;

  const payload = asRecord(body.payload);
  const text = payload?.text;

  if (!isString(text) || text.trim().length === 0) {
    writeJson(response, 400, { error: "text (non-empty string) is required" }, corsOrigin);

    return true;
  }

  const coordinationId = decodeURIComponent(match[1] ?? "");
  const result = addTodoItem(workspaceCwd, coordinationId, text.trim());

  if (!result) {
    writeJson(response, 404, { error: "Coordination todo.md not found" }, corsOrigin);

    return true;
  }

  writeJson(response, 201, result, corsOrigin);

  return true;
};

const DECK_TODO_DELETE_PATTERN = /^\/api\/deck\/coordinations\/([^/]+)\/todo\/delete$/;

export const handleDeckTodoDeleteRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { workspaceCwd },
) => {
  const match = requestUrl.pathname.match(DECK_TODO_DELETE_PATTERN);

  if (!match) return false;

  if (request.method !== "POST") {
    writeMethodNotAllowed(response, corsOrigin);

    return true;
  }

  const body = await readJsonBodyOrWriteError(request, response, corsOrigin);

  if (!body.ok) return true;

  const itemIndex = asRecord(body.payload)?.itemIndex;

  if (!isNumber(itemIndex)) {
    writeJson(response, 400, { error: "itemIndex (number) is required" }, corsOrigin);

    return true;
  }

  // SAFETY: the route pattern's only capture group is non-optional, so a successful match always fills match[1].
  const coordinationId = decodeURIComponent(match[1] as string);
  const result = deleteTodoItem(workspaceCwd, coordinationId, itemIndex);

  if (!result) {
    writeJson(response, 404, { error: "Todo item not found" }, corsOrigin);

    return true;
  }

  writeJson(response, 200, result, corsOrigin);

  return true;
};

const DECK_TODO_SOLVE_PATTERN = /^\/api\/deck\/coordinations\/([^/]+)\/todo\/solve$/;

export const handleDeckTodoSolveRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { runtime, workspaceCwd, projectStateDir, promptsDir, getApiPort },
) => {
  const match = requestUrl.pathname.match(DECK_TODO_SOLVE_PATTERN);

  if (!match) return false;

  if (request.method !== "POST") {
    writeMethodNotAllowed(response, corsOrigin);

    return true;
  }

  const bodyReadResult = await readJsonBodyOrWriteError(request, response, corsOrigin);

  if (!bodyReadResult.ok) return true;

  const body = asRecord(bodyReadResult.payload) ?? {};
  const itemIndex = body.itemIndex;

  if (!isNumber(itemIndex)) {
    writeJson(response, 400, { error: "itemIndex (number) is required" }, corsOrigin);

    return true;
  }

  const agentProviderResult = parseTerminalAgentProvider(body);

  if (agentProviderResult.error) {
    writeJson(response, 400, { error: agentProviderResult.error }, corsOrigin);

    return true;
  }

  // SAFETY: the route pattern's only capture group is non-optional, so a successful match always fills match[1].
  const coordinationId = decodeURIComponent(match[1] as string);
  const todoContent = readDeckVaultFile(workspaceCwd, coordinationId, "todo.md");

  if (todoContent === null) {
    writeJson(response, 404, { error: "Coordination or todo.md not found." }, corsOrigin);

    return true;
  }

  const todoResult = parseTodoProgress(todoContent);
  const todoItem = todoResult.items[itemIndex] ?? null;

  if (!todoItem) {
    writeJson(response, 404, { error: "Todo item not found." }, corsOrigin);

    return true;
  }

  if (todoItem.done) {
    writeJson(response, 400, { error: "Todo item is already complete." }, corsOrigin);

    return true;
  }

  const terminalId = `${coordinationId}-todo-${itemIndex}`;

  const existingTerminal = runtime
    .listTerminalSnapshots()
    .find((terminal) => terminal.terminalId === terminalId);

  if (existingTerminal) {
    writeJson(
      response,
      409,
      { error: "A solve agent is already active for this todo item.", terminalId },
      corsOrigin,
    );

    return true;
  }

  const deckOrchestrations = readDeckCoordinations(workspaceCwd, projectStateDir);

  const deckEntry = deckOrchestrations.find(
    (orchestration) => orchestration.coordinationId === coordinationId,
  );

  const coordinationName = deckEntry?.displayName ?? coordinationId;

  try {
    const workerPrompt = await buildSingleTodoWorkerPrompt({
      promptsDir,
      workspaceCwd,
      coordinationId,
      coordinationName,
      todoItemText: todoItem.text,
      terminalId,
      apiPort: getApiPort(),
    });

    const createInput: DeckTerminalCreateInput = {
      terminalId,
      coordinationId,
      coordinationName,
      nameOrigin: "generated",
      autoRenamePromptContext: todoItem.text,
      workspaceMode: "shared",
    };

    if (agentProviderResult.agentProvider) {
      createInput.agentProvider = agentProviderResult.agentProvider;
    }

    if (workerPrompt) {
      createInput.initialPrompt = workerPrompt;
    }

    const snapshot = runtime.createTerminal(createInput);

    writeJson(
      response,
      201,
      {
        terminalId: snapshot.terminalId,
        coordinationId,
        itemIndex,
        workspaceMode: "shared",
      },
      corsOrigin,
    );

    return true;
  } catch (error) {
    if (error instanceof RuntimeInputError) {
      writeJson(response, 400, { error: error.message }, corsOrigin);

      return true;
    }

    throw error;
  }
};
