import { MonitorInputError } from "../monitor";
import { parseMonitorConfigPatch } from "./monitorParsers";
import type { ApiRouteHandler } from "./routeHelpers";
import { readJsonBodyOrWriteError, writeJson, writeMethodNotAllowed } from "./routeHelpers";

export const handleMonitorConfigRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { monitorService },
) => {
  if (requestUrl.pathname !== "/api/monitor/config") {
    return false;
  }

  if (request.method === "GET") {
    const payload = await monitorService.readConfig();
    writeJson(response, 200, payload, corsOrigin);
    return true;
  }

  if (request.method !== "PATCH") {
    writeMethodNotAllowed(response, corsOrigin);
    return true;
  }

  const bodyReadResult = await readJsonBodyOrWriteError(request, response, corsOrigin);
  if (!bodyReadResult.ok) {
    return true;
  }

  const patchResult = parseMonitorConfigPatch(bodyReadResult.payload);
  if (patchResult.error || !patchResult.patch) {
    writeJson(
      response,
      400,
      { error: patchResult.error ?? "Invalid monitor config patch." },
      corsOrigin,
    );
    return true;
  }

  try {
    const payload = await monitorService.patchConfig(patchResult.patch);
    writeJson(response, 200, payload, corsOrigin);
    return true;
  } catch (error) {
    if (error instanceof MonitorInputError) {
      writeJson(response, 400, { error: error.message }, corsOrigin);
      return true;
    }

    throw error;
  }
};

export const handleMonitorFeedRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { monitorService },
) => {
  if (requestUrl.pathname !== "/api/monitor/feed") {
    return false;
  }

  if (request.method !== "GET") {
    writeMethodNotAllowed(response, corsOrigin);
    return true;
  }

  const payload = await monitorService.readFeed({
    forceRefresh: false,
    refreshIfStale: true,
  });
  writeJson(response, 200, payload, corsOrigin);
  return true;
};

export const handleMonitorRefreshRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { monitorService },
) => {
  if (requestUrl.pathname !== "/api/monitor/refresh") {
    return false;
  }

  if (request.method !== "POST") {
    writeMethodNotAllowed(response, corsOrigin);
    return true;
  }

  const payload = await monitorService.readFeed({
    forceRefresh: true,
    refreshIfStale: true,
  });
  writeJson(response, 200, payload, corsOrigin);
  return true;
};
