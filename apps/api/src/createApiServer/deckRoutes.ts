import { asRecord, isString, isTerminalAgentProvider } from "@adadex/core";

import {
  createDeckCoordination,
  deleteDeckCoordination,
  listDeckAvailableSkills,
  readDeckCoordinations,
  readDeckVaultFile,
  updateDeckCoordinationAgent,
  updateDeckCoordinationMascot,
  updateDeckCoordinationSuggestedSkills,
} from "../deck/readDeckCoordinations";
import {} from "../deck/swarmPrompts";
import {} from "../terminalRuntime";
import { type DeckAgentProviderUpdate, type DeckMascotUpdate } from "./deckRouteShared";
import type { ApiRouteHandler } from "./routeHelpers";
import {
  readJsonBodyOrWriteError,
  writeJson,
  writeMethodNotAllowed,
  writeNoContent,
  writeText,
} from "./routeHelpers";

export {
  handleDeckTodoAddRoute,
  handleDeckTodoDeleteRoute,
  handleDeckTodoEditRoute,
  handleDeckTodoSolveRoute,
  handleDeckTodoToggleRoute,
} from "./deckTodoRoutes";

export { handleDeckOrchestrationSwarmRoute } from "./deckSwarmRoutes";

export const handleDeckOrchestrationsRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { workspaceCwd, projectStateDir },
) => {
  if (requestUrl.pathname !== "/api/deck/coordinations") return false;

  if (request.method === "GET") {
    const orchestrations = readDeckCoordinations(workspaceCwd, projectStateDir);
    writeJson(response, 200, orchestrations, corsOrigin);

    return true;
  }

  if (request.method === "POST") {
    const bodyReadResult = await readJsonBodyOrWriteError(request, response, corsOrigin);

    if (!bodyReadResult.ok) return true;

    const body = asRecord(bodyReadResult.payload);
    const name = body && isString(body.name) ? body.name : "";
    const description = body && isString(body.description) ? body.description : "";
    const color = body && isString(body.color) ? body.color : "#d4a017";

    const suggestedSkills =
      body && Array.isArray(body.suggestedSkills)
        ? body.suggestedSkills.filter((skill): skill is string => isString(skill))
        : [];

    const rawAppearance = asRecord(body?.mascot) ?? asRecord(body?.octopus);

    const mascot = {
      animation:
        rawAppearance && isString(rawAppearance.animation) ? rawAppearance.animation : null,
      expression:
        rawAppearance && isString(rawAppearance.expression) ? rawAppearance.expression : null,
      accessory:
        rawAppearance && isString(rawAppearance.accessory) ? rawAppearance.accessory : null,
      hairColor:
        rawAppearance && isString(rawAppearance.hairColor) ? rawAppearance.hairColor : null,
    };

    const result = createDeckCoordination(
      workspaceCwd,
      { name, description, color, mascot, suggestedSkills },
      projectStateDir,
    );

    if (!result.ok) {
      writeJson(response, 400, { error: result.error }, corsOrigin);

      return true;
    }

    writeJson(response, 201, result.coordination, corsOrigin);

    return true;
  }

  writeMethodNotAllowed(response, corsOrigin);

  return true;
};

export const handleDeckSkillsRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { workspaceCwd },
) => {
  if (requestUrl.pathname !== "/api/deck/skills") return false;

  if (request.method !== "GET") {
    writeMethodNotAllowed(response, corsOrigin);

    return true;
  }

  writeJson(response, 200, listDeckAvailableSkills(workspaceCwd), corsOrigin);

  return true;
};

const DECK_COORDINATION_ITEM_PATTERN = /^\/api\/deck\/coordinations\/([^/]+)$/;

export const handleDeckOrchestrationItemRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { workspaceCwd, projectStateDir },
) => {
  const match = requestUrl.pathname.match(DECK_COORDINATION_ITEM_PATTERN);

  if (!match) return false;

  const coordinationId = decodeURIComponent(match[1] ?? "");

  if (request.method === "DELETE") {
    const result = deleteDeckCoordination(workspaceCwd, coordinationId, projectStateDir);

    if (!result.ok) {
      writeJson(response, 404, { error: result.error }, corsOrigin);

      return true;
    }

    writeNoContent(response, 204, corsOrigin);

    return true;
  }

  if (request.method === "PATCH") {
    const body = await readJsonBodyOrWriteError(request, response, corsOrigin);

    if (!body.ok) return true;

    const payload = asRecord(body.payload);

    if (!payload) {
      writeJson(response, 400, { error: "Request body is required" }, corsOrigin);

      return true;
    }

    const mascot: DeckMascotUpdate = {};

    if (isString(payload.color)) mascot.color = payload.color;
    const m = asRecord(payload.mascot);

    if (m) {
      if (isString(m.animation)) mascot.animation = m.animation;

      if (isString(m.expression)) mascot.expression = m.expression;

      if (isString(m.accessory)) mascot.accessory = m.accessory;

      if (isString(m.hairColor)) mascot.hairColor = m.hairColor;
    }

    const updated = updateDeckCoordinationMascot(
      workspaceCwd,
      coordinationId,
      mascot,
      projectStateDir,
    );

    if (!updated) {
      writeJson(response, 404, { error: "Coordination not found" }, corsOrigin);

      return true;
    }

    writeJson(response, 200, updated, corsOrigin);

    return true;
  }

  writeMethodNotAllowed(response, corsOrigin);

  return true;
};

const DECK_VAULT_FILE_PATTERN = /^\/api\/deck\/coordinations\/([^/]+)\/files\/([^/]+)$/;

export const handleDeckVaultFileRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { workspaceCwd },
) => {
  const match = requestUrl.pathname.match(DECK_VAULT_FILE_PATTERN);

  if (!match) return false;

  const coordinationId = decodeURIComponent(match[1] ?? "");
  const fileName = decodeURIComponent(match[2] ?? "");

  if (request.method !== "GET") {
    writeMethodNotAllowed(response, corsOrigin);

    return true;
  }

  const content = readDeckVaultFile(workspaceCwd, coordinationId, fileName);

  if (content === null) {
    writeJson(response, 404, { error: "Vault file not found" }, corsOrigin);

    return true;
  }

  writeText(response, 200, content, "text/markdown; charset=utf-8", corsOrigin);

  return true;
};

const DECK_COORDINATION_SKILLS_PATTERN = /^\/api\/deck\/coordinations\/([^/]+)\/skills$/;

export const handleDeckOrchestrationSkillsRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { workspaceCwd, projectStateDir },
) => {
  const match = requestUrl.pathname.match(DECK_COORDINATION_SKILLS_PATTERN);

  if (!match) return false;

  if (request.method !== "PATCH") {
    writeMethodNotAllowed(response, corsOrigin);

    return true;
  }

  const body = await readJsonBodyOrWriteError(request, response, corsOrigin);

  if (!body.ok) return true;

  const payload = asRecord(body.payload);

  const suggestedSkills = Array.isArray(payload?.suggestedSkills)
    ? payload.suggestedSkills.filter((skill): skill is string => isString(skill))
    : null;

  if (suggestedSkills === null) {
    writeJson(response, 400, { error: "suggestedSkills (string[]) is required" }, corsOrigin);

    return true;
  }

  const coordinationId = decodeURIComponent(match[1] ?? "");

  const updated = updateDeckCoordinationSuggestedSkills(
    workspaceCwd,
    coordinationId,
    suggestedSkills,
    projectStateDir,
  );

  if (!updated) {
    writeJson(response, 404, { error: "Coordination not found" }, corsOrigin);

    return true;
  }

  writeJson(response, 200, updated, corsOrigin);

  return true;
};

const DECK_COORDINATION_AGENT_PATTERN = /^\/api\/deck\/coordinations\/([^/]+)\/agent$/;

export const handleDeckOrchestrationAgentRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { workspaceCwd, projectStateDir },
) => {
  const match = requestUrl.pathname.match(DECK_COORDINATION_AGENT_PATTERN);

  if (!match) return false;

  if (request.method !== "PATCH") {
    writeMethodNotAllowed(response, corsOrigin);

    return true;
  }

  const body = await readJsonBodyOrWriteError(request, response, corsOrigin);

  if (!body.ok) return true;

  const payload = asRecord(body.payload);

  if (!payload) {
    writeJson(response, 400, { error: "Request body is required" }, corsOrigin);

    return true;
  }

  const coordinationId = decodeURIComponent(match[1] ?? "");

  const rawAgentProvider = payload.agentProvider;

  if (rawAgentProvider !== undefined && rawAgentProvider !== null) {
    if (!isString(rawAgentProvider) || !isTerminalAgentProvider(rawAgentProvider)) {
      writeJson(
        response,
        400,
        { error: "agentProvider must be a valid agent provider" },
        corsOrigin,
      );

      return true;
    }
  }

  const agentUpdate: DeckAgentProviderUpdate = {};

  if (rawAgentProvider === null) {
    agentUpdate.agentProvider = null;
  } else if (isString(rawAgentProvider) && isTerminalAgentProvider(rawAgentProvider)) {
    agentUpdate.agentProvider = rawAgentProvider;
  }

  const updated = updateDeckCoordinationAgent(
    workspaceCwd,
    coordinationId,
    agentUpdate,
    projectStateDir,
  );

  if (!updated) {
    writeJson(response, 404, { error: "Coordination not found" }, corsOrigin);

    return true;
  }

  writeJson(response, 200, updated, corsOrigin);

  return true;
};
