import { createWriteStream, mkdirSync } from "node:fs";
import { join } from "node:path";

import {
  type ConversationTranscriptEvent,
  type ConversationTranscriptEventPayload,
  ensureTranscriptDirectory,
  transcriptFilenameForSession,
} from "./conversations";
import type { TerminalSession } from "./types";

export const getShellLaunch = () => {
  if (process.platform === "win32") {
    return {
      command: process.env.ComSpec ?? "cmd.exe",
      args: [],
    };
  }

  const shellFromEnvironment = process.env.SHELL?.trim();

  if (shellFromEnvironment && shellFromEnvironment.length > 0) {
    return {
      command: shellFromEnvironment,
      args: ["-i"],
    };
  }

  return {
    command: "/bin/bash",
    args: ["-i"],
  };
};

export const createDebugLog = (
  sessionId: string,
  isDebugPtyLogsEnabled: boolean,
  ptyLogDir: string,
) => {
  if (!isDebugPtyLogsEnabled) {
    return undefined;
  }

  mkdirSync(ptyLogDir, { recursive: true });
  const filename = `${sessionId}-${Date.now()}.log`;

  return createWriteStream(join(ptyLogDir, filename), {
    flags: "a",
    encoding: "utf8",
  });
};

export const appendDebugLog = (session: TerminalSession, line: string) => {
  session.debugLog?.write(`${new Date().toISOString()} ${line}\n`);
};

export const createTranscriptLog = (sessionId: string, transcriptDirectoryPath: string) => {
  ensureTranscriptDirectory(transcriptDirectoryPath);
  const filename = transcriptFilenameForSession(sessionId);

  const stream = createWriteStream(join(transcriptDirectoryPath, filename), {
    flags: "a",
    encoding: "utf8",
  });

  stream.on("error", () => {});

  return stream;
};

export const appendTranscriptEvent = (
  session: TerminalSession,
  sessionId: string,
  event: ConversationTranscriptEventPayload,
) => {
  if (!session.transcriptLog) {
    return;
  }

  const nextEventCount = (session.transcriptEventCount ?? 0) + 1;
  session.transcriptEventCount = nextEventCount;

  // SAFETY: event is a validated ConversationTranscriptEventPayload; adding the ids
  // completes the same discriminated union with no field changes.
  const payload: ConversationTranscriptEvent = {
    ...event,
    eventId: `${sessionId}:${nextEventCount}`,
    sessionId,
    coordinationId: session.coordinationId,
  } as ConversationTranscriptEvent;

  session.transcriptLog.write(`${JSON.stringify(payload)}\n`);
};

export const closeTranscript = (
  session: TerminalSession,
  sessionId: string,
  event: ConversationTranscriptEventPayload,
) => {
  if (session.hasTranscriptEnded) {
    return;
  }

  appendTranscriptEvent(session, sessionId, event);
  session.hasTranscriptEnded = true;
  session.transcriptLog?.end();
  session.transcriptLog = undefined;
};

export const appendScrollback = (
  session: TerminalSession,
  chunk: string,
  scrollbackMaxBytes: number,
) => {
  let nextChunk = chunk;
  let nextChunkBytes = Buffer.byteLength(nextChunk, "utf8");

  if (nextChunkBytes > scrollbackMaxBytes) {
    const chunkBuffer = Buffer.from(nextChunk, "utf8");
    nextChunk = chunkBuffer.subarray(chunkBuffer.length - scrollbackMaxBytes).toString("utf8");
    nextChunkBytes = Buffer.byteLength(nextChunk, "utf8");
    session.scrollbackChunks = [];
    session.scrollbackBytes = 0;
  }

  session.scrollbackChunks.push(nextChunk);
  session.scrollbackBytes += nextChunkBytes;

  while (session.scrollbackBytes > scrollbackMaxBytes && session.scrollbackChunks.length > 0) {
    const removedChunk = session.scrollbackChunks.shift();

    if (!removedChunk) {
      break;
    }

    session.scrollbackBytes -= Buffer.byteLength(removedChunk, "utf8");
  }
};
