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

    const payload = body.payload as Record<string, unknown> | null;
    const toolName = payload && typeof payload.tool_name === "string" ? payload.tool_name : "";
    const toolInput =
      payload && typeof payload.tool_input === "object" && payload.tool_input !== null
        ? (payload.tool_input as Record<string, unknown>)
        : {};
    const filePath = typeof toolInput.file_path === "string" ? toolInput.file_path : "";

    if (filePath.length === 0) {
      writeJson(response, 200, { ok: true, skipped: true }, corsOrigin);
      return true;
    }

    // Prefer Octogent session ID from header, fall back to the agent CLI session_id from payload
    const octogentSession =
      typeof request.headers["x-octogent-session"] === "string" &&
      request.headers["x-octogent-session"].length > 0
        ? request.headers["x-octogent-session"]
        : undefined;
    const payloadSessionId =
      payload && typeof payload.session_id === "string" && payload.session_id.length > 0
        ? payload.session_id
        : undefined;
    const sessionId = octogentSession ?? payloadSessionId ?? "unknown";

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
