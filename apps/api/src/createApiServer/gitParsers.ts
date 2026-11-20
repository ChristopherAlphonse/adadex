import { isObjectValue, isString, type ParsedRecord } from "@adadex/core";

import type { JsonRequestPayload } from "./requestParsers";

type CommitMessageParseResult = { message: string | null; error: string | null };

type SyncBaseRefParseResult = { baseRef: string | null; error: string | null };

type PullRequestInputParseResult = {
  title: string | null;
  body: string;
  baseRef: string | null;
  error: string | null;
};

export const parseOrchestrationCommitMessage = (
  payload: JsonRequestPayload,
): CommitMessageParseResult => {
  if (payload === null || payload === undefined || !isObjectValue(payload)) {
    return {
      message: null,
      error: "Expected a JSON object body.",
    };
  }

  // SAFETY: parse boundary produced ParsedValue members; object or array keys read as ParsedValue.
  const record = payload as ParsedRecord;
  const rawMessage = record.message;

  if (!isString(rawMessage)) {
    return {
      message: null,
      error: "Commit message must be a string.",
    };
  }

  const trimmed = rawMessage.trim();

  if (trimmed.length === 0) {
    return {
      message: null,
      error: "Commit message cannot be empty.",
    };
  }

  return {
    message: trimmed,
    error: null,
  };
};

export const parseOrchestrationSyncBaseRef = (
  payload: JsonRequestPayload,
): SyncBaseRefParseResult => {
  if (payload === null || payload === undefined) {
    return {
      baseRef: null,
      error: null,
    };
  }

  if (!isObjectValue(payload)) {
    return {
      baseRef: null,
      error: "Expected a JSON object body.",
    };
  }

  // SAFETY: parse boundary produced ParsedValue members; object or array keys read as ParsedValue.
  const record = payload as ParsedRecord;
  const rawBaseRef = record.baseRef;

  if (rawBaseRef === undefined) {
    return {
      baseRef: null,
      error: null,
    };
  }

  if (!isString(rawBaseRef)) {
    return {
      baseRef: null,
      error: "baseRef must be a string.",
    };
  }

  const trimmed = rawBaseRef.trim();

  if (trimmed.length === 0) {
    return {
      baseRef: null,
      error: "baseRef cannot be empty.",
    };
  }

  return {
    baseRef: trimmed,
    error: null,
  };
};

export const parseOrchestrationPullRequestCreateInput = (
  payload: JsonRequestPayload,
): PullRequestInputParseResult => {
  if (payload === null || payload === undefined || !isObjectValue(payload)) {
    return {
      title: null,
      body: "",
      baseRef: null,
      error: "Expected a JSON object body.",
    };
  }

  // SAFETY: parse boundary produced ParsedValue members; object or array keys read as ParsedValue.
  const record = payload as ParsedRecord;

  if (!isString(record.title) || record.title.trim().length === 0) {
    return {
      title: null,
      body: "",
      baseRef: null,
      error: "Pull request title cannot be empty.",
    };
  }

  if (record.body !== undefined && !isString(record.body)) {
    return {
      title: null,
      body: "",
      baseRef: null,
      error: "Pull request body must be a string.",
    };
  }

  if (record.baseRef !== undefined && !isString(record.baseRef)) {
    return {
      title: null,
      body: "",
      baseRef: null,
      error: "Pull request baseRef must be a string.",
    };
  }

  const normalizedBaseRef = isString(record.baseRef) ? record.baseRef.trim() : "";

  if (record.baseRef !== undefined && normalizedBaseRef.length === 0) {
    return {
      title: null,
      body: "",
      baseRef: null,
      error: "Pull request baseRef cannot be empty.",
    };
  }

  return {
    title: record.title.trim(),
    body: isString(record.body) ? record.body : "",
    baseRef: normalizedBaseRef.length > 0 ? normalizedBaseRef : null,
    error: null,
  };
};
