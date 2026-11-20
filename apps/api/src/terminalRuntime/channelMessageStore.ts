import { existsSync, readFileSync } from "node:fs";

import { writeTextFileAtomic } from "../atomicJsonFile";
import type { ChannelMessage } from "./types";

export const CHANNEL_MESSAGES_VERSION = 1 as const;

export type ChannelMessagesDocument = {
  version: typeof CHANNEL_MESSAGES_VERSION;
  messages: ChannelMessage[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isChannelMessage = (value: unknown): value is ChannelMessage => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.messageId === "string" &&
    value.messageId.length > 0 &&
    typeof value.fromTerminalId === "string" &&
    typeof value.toTerminalId === "string" &&
    value.toTerminalId.length > 0 &&
    typeof value.content === "string" &&
    typeof value.timestamp === "string" &&
    typeof value.delivered === "boolean"
  );
};

/** Loads persisted queues grouped by recipient. A corrupt store is ignored, not fatal. */
export const loadChannelMessages = (registryPath: string): Map<string, ChannelMessage[]> => {
  const queues = new Map<string, ChannelMessage[]>();
  if (!existsSync(registryPath)) {
    return queues;
  }

  try {
    const parsed: unknown = JSON.parse(readFileSync(registryPath, "utf8"));
    if (
      !isRecord(parsed) ||
      parsed.version !== CHANNEL_MESSAGES_VERSION ||
      !Array.isArray(parsed.messages)
    ) {
      return queues;
    }

    for (const candidate of parsed.messages) {
      if (!isChannelMessage(candidate)) {
        continue;
      }

      const queue = queues.get(candidate.toTerminalId) ?? [];
      queue.push({ ...candidate });
      queues.set(candidate.toTerminalId, queue);
    }
  } catch {
    // A corrupt message store must not block startup; pending messages are best-effort.
  }

  return queues;
};

export const persistChannelMessages = (
  registryPath: string,
  queues: Map<string, ChannelMessage[]>,
  dependencies?: Parameters<typeof writeTextFileAtomic>[2],
): void => {
  const document: ChannelMessagesDocument = {
    version: CHANNEL_MESSAGES_VERSION,
    messages: [...queues.values()].flat(),
  };
  writeTextFileAtomic(registryPath, `${JSON.stringify(document, null, 2)}\n`, dependencies);
};
