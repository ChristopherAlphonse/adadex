import { isObjectValue, isString, type ParsedRecord } from "@adadex/core";
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

    const toolInput =
      payload && isObjectValue(payload.tool_input) && payload.tool_input !== null
        ? // SAFETY: an object-valued ParsedValue member is a parsed record at runtime.
          (payload.tool_input as ParsedRecord)
        : {};

    const filePath = isString(toolInput.file_path) ? toolInput.file_path : "";

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
