import { RuntimeInputError } from "../terminalRuntime";
import {
  parseOrchestrationCommitMessage,
  parseOrchestrationPullRequestCreateInput,
  parseOrchestrationSyncBaseRef,
} from "./gitParsers";
import type { ApiRouteHandler } from "./routeHelpers";
import { readJsonBodyOrWriteError, writeJson, writeMethodNotAllowed } from "./routeHelpers";

const COORDINATION_GIT_ACTION_PATH_PATTERN =
  /^\/api\/coordinations\/([^/]+)\/git\/(status|commit|push|sync)$/;
const COORDINATION_GIT_PULL_REQUEST_PATH_PATTERN = /^\/api\/coordinations\/([^/]+)\/git\/pr$/;
const COORDINATION_GIT_PULL_REQUEST_MERGE_PATH_PATTERN =
  /^\/api\/coordinations\/([^/]+)\/git\/pr\/merge$/;

export const handleOrchestrationGitRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { runtime },
) => {
  const gitMatch = requestUrl.pathname.match(COORDINATION_GIT_ACTION_PATH_PATTERN);
  if (!gitMatch) {
    return false;
  }

  const coordinationId = decodeURIComponent(gitMatch[1] ?? "");
  const action = gitMatch[2];

  try {
    if (action === "status") {
      if (request.method !== "GET") {
        writeMethodNotAllowed(response, corsOrigin);
        return true;
      }

      const payload = runtime.readOrchestrationGitStatus(coordinationId);
      if (!payload) {
        writeJson(response, 404, { error: "Orchestration not found." }, corsOrigin);
        return true;
      }

      writeJson(response, 200, payload, corsOrigin);
      return true;
    }

    if (action === "commit") {
      if (request.method !== "POST") {
        writeMethodNotAllowed(response, corsOrigin);
        return true;
      }

      const bodyReadResult = await readJsonBodyOrWriteError(request, response, corsOrigin);
      if (!bodyReadResult.ok) {
        return true;
      }

      const commitMessageResult = parseOrchestrationCommitMessage(bodyReadResult.payload);
      if (commitMessageResult.error || !commitMessageResult.message) {
        writeJson(
          response,
          400,
          { error: commitMessageResult.error ?? "Commit message cannot be empty." },
          corsOrigin,
        );
        return true;
      }

      const payload = runtime.commitOrchestrationWorktree(
        coordinationId,
        commitMessageResult.message,
      );
      if (!payload) {
        writeJson(response, 404, { error: "Orchestration not found." }, corsOrigin);
        return true;
      }

      writeJson(response, 200, payload, corsOrigin);
      return true;
    }

    if (action === "push") {
      if (request.method !== "POST") {
        writeMethodNotAllowed(response, corsOrigin);
        return true;
      }

      const payload = runtime.pushOrchestrationWorktree(coordinationId);
      if (!payload) {
        writeJson(response, 404, { error: "Orchestration not found." }, corsOrigin);
        return true;
      }

      writeJson(response, 200, payload, corsOrigin);
      return true;
    }

    if (request.method !== "POST") {
      writeMethodNotAllowed(response, corsOrigin);
      return true;
    }

    const bodyReadResult = await readJsonBodyOrWriteError(request, response, corsOrigin);
    if (!bodyReadResult.ok) {
      return true;
    }

    const baseRefResult = parseOrchestrationSyncBaseRef(bodyReadResult.payload);
    if (baseRefResult.error) {
      writeJson(response, 400, { error: baseRefResult.error }, corsOrigin);
      return true;
    }

    const payload = runtime.syncOrchestrationWorktree(
      coordinationId,
      baseRefResult.baseRef ?? undefined,
    );
    if (!payload) {
      writeJson(response, 404, { error: "Orchestration not found." }, corsOrigin);
      return true;
    }

    writeJson(response, 200, payload, corsOrigin);
    return true;
  } catch (error) {
    if (error instanceof RuntimeInputError) {
      writeJson(response, 409, { error: error.message }, corsOrigin);
      return true;
    }
    throw error;
  }
};

export const handleOrchestrationGitPullRequestRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { runtime },
) => {
  const mergeMatch = requestUrl.pathname.match(COORDINATION_GIT_PULL_REQUEST_MERGE_PATH_PATTERN);
  if (mergeMatch) {
    if (request.method !== "POST") {
      writeMethodNotAllowed(response, corsOrigin);
      return true;
    }

    const coordinationId = decodeURIComponent(mergeMatch[1] ?? "");
    try {
      const payload = runtime.mergeOrchestrationPullRequest(coordinationId);
      if (!payload) {
        writeJson(response, 404, { error: "Orchestration not found." }, corsOrigin);
        return true;
      }

      writeJson(response, 200, payload, corsOrigin);
      return true;
    } catch (error) {
      if (error instanceof RuntimeInputError) {
        writeJson(response, 409, { error: error.message }, corsOrigin);
        return true;
      }
      throw error;
    }
  }

  const prMatch = requestUrl.pathname.match(COORDINATION_GIT_PULL_REQUEST_PATH_PATTERN);
  if (!prMatch) {
    return false;
  }

  const coordinationId = decodeURIComponent(prMatch[1] ?? "");

  try {
    if (request.method === "GET") {
      const payload = runtime.readOrchestrationPullRequest(coordinationId);
      if (!payload) {
        writeJson(response, 404, { error: "Orchestration not found." }, corsOrigin);
        return true;
      }

      writeJson(response, 200, payload, corsOrigin);
      return true;
    }

    if (request.method !== "POST") {
      writeMethodNotAllowed(response, corsOrigin);
      return true;
    }

    const bodyReadResult = await readJsonBodyOrWriteError(request, response, corsOrigin);
    if (!bodyReadResult.ok) {
      return true;
    }

    const pullRequestInput = parseOrchestrationPullRequestCreateInput(bodyReadResult.payload);
    if (pullRequestInput.error || !pullRequestInput.title) {
      writeJson(
        response,
        400,
        { error: pullRequestInput.error ?? "Pull request title cannot be empty." },
        corsOrigin,
      );
      return true;
    }

    const payload = runtime.createOrchestrationPullRequest(coordinationId, {
      title: pullRequestInput.title,
      ...(pullRequestInput.body.length > 0 ? { body: pullRequestInput.body } : {}),
      ...(pullRequestInput.baseRef !== null ? { baseRef: pullRequestInput.baseRef } : {}),
    });
    if (!payload) {
      writeJson(response, 404, { error: "Orchestration not found." }, corsOrigin);
      return true;
    }

    writeJson(response, 200, payload, corsOrigin);
    return true;
  } catch (error) {
    if (error instanceof RuntimeInputError) {
      writeJson(response, 409, { error: error.message }, corsOrigin);
      return true;
    }
    throw error;
  }
};
