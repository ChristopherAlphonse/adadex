import { isString, type ParsedValue } from "@adadex/core";
import type { IncomingMessage } from "node:http";

const MAX_JSON_BODY_BYTES = 1024 * 1024;

/** A JSON body once it has crossed the parse boundary; undefined covers absent callers. */
export type JsonRequestPayload = ParsedValue | undefined;

export class RequestBodyTooLargeError extends Error {}

export const readJsonBody = async (request: IncomingMessage): Promise<JsonRequestPayload> => {
  let totalBytes = 0;
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    const nextChunk = isString(chunk) ? Buffer.from(chunk) : chunk;
    totalBytes += nextChunk.length;

    if (totalBytes > MAX_JSON_BODY_BYTES) {
      throw new RequestBodyTooLargeError("Request body too large.");
    }

    chunks.push(nextChunk);
  }

  const payload = Buffer.concat(chunks).toString("utf8").trim();

  if (payload.length === 0) {
    return null;
  }

  // SAFETY: JSON.parse can only produce JSON scalars, arrays, or plain objects.
  return JSON.parse(payload) as JsonRequestPayload;
};
