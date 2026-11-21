import { asRecord, isString, toolCallPaths, type ParsedRecord } from "@adadex/core";

import type { ApiRouteHandler } from "./routeHelpers";
import { readJsonBodyOrWriteError, writeJson, writeMethodNotAllowed } from "./routeHelpers";

export const handleCodeIntelEventsRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { codeIntelStore },
) => {
  if (requestUrl.pathname !== "/api/code-intel/events") {
    return false;
  }

  if (request.method === "POST") {
    const body = await readJsonBodyOrWriteError(request, response, corsOrigin);

    if (!body.ok) return true;

    // SAFETY: readJsonBody parsed the body into ParsedValue members, including nested values.
    const payload = body.payload as ParsedRecord | null;
    const toolName = payload && isString(payload.tool_name) ? payload.tool_name : "";

    const toolInput = payload ? (asRecord(payload.tool_input) ?? {}) : {};

    const filePath = toolCallPaths(toolInput)[0] ?? "";

    if (filePath.length === 0) {
      writeJson(response, 200, { ok: true, skipped: true }, corsOrigin);

      return true;
    }

    const sessionId =
      payload && isString(payload.session_id) && payload.session_id.length > 0
        ? payload.session_id
        : "unknown";

    await codeIntelStore.append({
      ts: new Date().toISOString(),
      sessionId,
      tool: toolName,
      file: filePath,
    });

    writeJson(response, 200, { ok: true }, corsOrigin);

    return true;
  }

  if (request.method === "GET") {
    const events = await codeIntelStore.readAll();
    writeJson(response, 200, { events }, corsOrigin);

    return true;
  }

  writeMethodNotAllowed(response, corsOrigin);

  return true;
};
