import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  type ConversationSearchHit,
  type ConversationSearchResult,
  type ConversationSessionDetail,
  type ConversationSessionSummary,
  type ConversationTurn,
  type ParsedValue,
  type TranscriptMessage,
  asRecord,
  asString,
  isNumber,
  isString,
} from "@adadex/core";

import type { AgentRuntimeState } from "../agentStateDetection";

const parseRuntimeState = (value: ParsedValue): AgentRuntimeState | null =>
  value === "idle" || value === "processing" ? value : null;

export type ConversationTranscriptEventBase = {
  eventId: string;
  sessionId: string;
  coordinationId: string;
  timestamp: string;
};

export type SessionStartTranscriptEvent = ConversationTranscriptEventBase & {
  type: "session_start";
};

export type InputSubmitTranscriptEvent = ConversationTranscriptEventBase & {
  type: "input_submit";
  submitId: string;
  text: string;
};

export type OutputChunkTranscriptEvent = ConversationTranscriptEventBase & {
  type: "output_chunk";
  chunkId: string;
  text: string;
};

export type StateChangeTranscriptEvent = ConversationTranscriptEventBase & {
  type: "state_change";
  state: AgentRuntimeState;
};

export type SessionEndTranscriptEvent = ConversationTranscriptEventBase & {
  type: "session_end";
  reason: "pty_exit" | "session_close" | "operator_stop" | "operator_kill";
  exitCode?: number;
  signal?: number | string;
};

export type ConversationTranscriptEvent =
  | SessionStartTranscriptEvent
  | InputSubmitTranscriptEvent
  | OutputChunkTranscriptEvent
  | StateChangeTranscriptEvent
  | SessionEndTranscriptEvent;

export type ConversationTranscriptEventPayload =
  | Omit<SessionStartTranscriptEvent, "eventId" | "sessionId" | "coordinationId">
  | Omit<InputSubmitTranscriptEvent, "eventId" | "sessionId" | "coordinationId">
  | Omit<OutputChunkTranscriptEvent, "eventId" | "sessionId" | "coordinationId">
  | Omit<StateChangeTranscriptEvent, "eventId" | "sessionId" | "coordinationId">
  | Omit<SessionEndTranscriptEvent, "eventId" | "sessionId" | "coordinationId">;

export type { ConversationTurn };

export const transcriptFilenameForSession = (sessionId: string) =>
  `${encodeURIComponent(sessionId)}.jsonl`;

const parseTranscriptEvent = (payload: ParsedValue): ConversationTranscriptEvent | null => {
  const value = asRecord(payload);

  if (!value) {
    return null;
  }

  const eventType = asString(value.type);
  const eventId = asString(value.eventId);
  const sessionId = asString(value.sessionId);
  const coordinationId = asString(value.coordinationId);
  const timestamp = asString(value.timestamp);

  if (!eventType || !eventId || !sessionId || !coordinationId || !timestamp) {
    return null;
  }

  if (eventType === "session_start") {
    return {
      type: "session_start",
      eventId,
      sessionId,
      coordinationId,
      timestamp,
    };
  }

  if (eventType === "input_submit") {
    const submitId = asString(value.submitId);
    const text = asString(value.text);

    if (!submitId || text === null) {
      return null;
    }

    return {
      type: "input_submit",
      eventId,
      sessionId,
      coordinationId,
      timestamp,
      submitId,
      text,
    };
  }

  if (eventType === "output_chunk") {
    const chunkId = asString(value.chunkId);
    const text = asString(value.text);

    if (!chunkId || text === null) {
      return null;
    }

    return {
      type: "output_chunk",
      eventId,
      sessionId,
      coordinationId,
      timestamp,
      chunkId,
      text,
    };
  }

  if (eventType === "state_change") {
    const state = parseRuntimeState(value.state ?? null);

    if (!state) {
      return null;
    }

    return {
      type: "state_change",
      eventId,
      sessionId,
      coordinationId,
      timestamp,
      state,
    };
  }

  if (eventType === "session_end") {
    const reason = value.reason;

    if (
      reason !== "pty_exit" &&
      reason !== "session_close" &&
      reason !== "operator_stop" &&
      reason !== "operator_kill"
    ) {
      return null;
    }

    const exitCode = isNumber(value.exitCode) ? value.exitCode : undefined;

    const signal = isNumber(value.signal) || isString(value.signal) ? value.signal : undefined;

    const event: SessionEndTranscriptEvent = {
      type: "session_end",
      eventId,
      sessionId,
      coordinationId,
      timestamp,
      reason,
    };

    if (exitCode !== undefined) {
      event.exitCode = exitCode;
    }

    if (signal !== undefined) {
      event.signal = signal;
    }

    return event;
  }

  return null;
};

const buildConversationSummary = (
  sessionId: string,
  events: ConversationTranscriptEvent[],
  turns: ConversationTurn[],
): ConversationSessionSummary => {
  const userTurns = turns.filter((turn) => turn.role === "user");
  const assistantTurns = turns.filter((turn) => turn.role === "assistant");
  const firstEvent = events[0] ?? null;
  const lastEvent = events.length > 0 ? events[events.length - 1] : null;

  const lastSessionEnd =
    [...events].reverse().find((event) => event.type === "session_end") ?? null;

  return {
    sessionId,
    coordinationId: firstEvent?.coordinationId ?? null,
    startedAt: firstEvent?.timestamp ?? null,
    endedAt: lastSessionEnd?.timestamp ?? null,
    lastEventAt: lastEvent?.timestamp ?? null,
    eventCount: events.length,
    turnCount: turns.length,
    userTurnCount: userTurns.length,
    assistantTurnCount: assistantTurns.length,
    firstUserTurnPreview: userTurns.length > 0 ? (userTurns[0]?.content ?? null) : null,
    lastUserTurnPreview:
      userTurns.length > 0 ? (userTurns[userTurns.length - 1]?.content ?? null) : null,
    lastAssistantTurnPreview:
      assistantTurns.length > 0
        ? (assistantTurns[assistantTurns.length - 1]?.content ?? null)
        : null,
  };
};

const parseTranscriptLines = (rawJsonl: string): ConversationTranscriptEvent[] => {
  const events: ConversationTranscriptEvent[] = [];
  const lines = rawJsonl.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      continue;
    }

    try {
      const parsed: ParsedValue = JSON.parse(trimmed);
      const event = parseTranscriptEvent(parsed);

      if (event) {
        events.push(event);
      }
    } catch {}
  }

  return events;
};

const readSessionEventsFromFile = (
  transcriptDirectoryPath: string,
  sessionId: string,
): ConversationTranscriptEvent[] => {
  const transcriptPath = join(transcriptDirectoryPath, transcriptFilenameForSession(sessionId));

  if (!existsSync(transcriptPath)) {
    return [];
  }

  const rawJsonl = readFileSync(transcriptPath, "utf8");

  return parseTranscriptLines(rawJsonl);
};

const parseSessionIdFromFilename = (filename: string): string | null => {
  if (!filename.endsWith(".jsonl")) {
    return null;
  }

  const basename = filename.slice(0, -".jsonl".length);

  if (basename.length === 0) {
    return null;
  }

  try {
    return decodeURIComponent(basename);
  } catch {
    return null;
  }
};

const truncatePreview = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= 160) {
    return normalized;
  }

  return `${normalized.slice(0, 157)}...`;
};

export const readConversationSession = (
  transcriptDirectoryPath: string,
  sessionId: string,
): ConversationSessionDetail | null => {
  const events = readSessionEventsFromFile(transcriptDirectoryPath, sessionId);

  if (events.length === 0) {
    return null;
  }

  const turns = readAgentTranscriptTurns(transcriptDirectoryPath, sessionId) ?? [];
  const summary = buildConversationSummary(sessionId, events, turns);

  return {
    ...summary,
    firstUserTurnPreview: truncatePreview(summary.firstUserTurnPreview),
    lastUserTurnPreview: truncatePreview(summary.lastUserTurnPreview),
    lastAssistantTurnPreview: truncatePreview(summary.lastAssistantTurnPreview),
    turns,
    events,
  };
};

export const listConversationSessions = (
  transcriptDirectoryPath: string,
): ConversationSessionSummary[] => {
  if (!existsSync(transcriptDirectoryPath)) {
    return [];
  }

  const sessionIds = readdirSync(transcriptDirectoryPath)
    .map((filename) => parseSessionIdFromFilename(filename))
    .filter((sessionId): sessionId is string => sessionId !== null);

  const summaries = sessionIds
    .map((sessionId) => {
      const detail = readConversationSession(transcriptDirectoryPath, sessionId);

      if (!detail || detail.turnCount === 0) {
        return null;
      }

      return {
        sessionId: detail.sessionId,
        coordinationId: detail.coordinationId,
        startedAt: detail.startedAt,
        endedAt: detail.endedAt,
        lastEventAt: detail.lastEventAt,
        eventCount: detail.eventCount,
        turnCount: detail.turnCount,
        userTurnCount: detail.userTurnCount,
        assistantTurnCount: detail.assistantTurnCount,
        firstUserTurnPreview: detail.firstUserTurnPreview,
        lastUserTurnPreview: detail.lastUserTurnPreview,
        lastAssistantTurnPreview: detail.lastAssistantTurnPreview,
      };
    })
    .filter((summary): summary is ConversationSessionSummary => summary !== null)
    .map((summary) => ({
      ...summary,
      firstUserTurnPreview: truncatePreview(summary.firstUserTurnPreview),
      lastUserTurnPreview: truncatePreview(summary.lastUserTurnPreview),
      lastAssistantTurnPreview: truncatePreview(summary.lastAssistantTurnPreview),
    }));

  return summaries.sort((left, right) => {
    const leftTime = left.lastEventAt ? Date.parse(left.lastEventAt) : 0;
    const rightTime = right.lastEventAt ? Date.parse(right.lastEventAt) : 0;

    return rightTime - leftTime;
  });
};

export const ensureTranscriptDirectory = (transcriptDirectoryPath: string) => {
  mkdirSync(transcriptDirectoryPath, { recursive: true });
};

export const deleteConversation = (transcriptDirectoryPath: string, sessionId: string) => {
  const transcriptFile = join(transcriptDirectoryPath, transcriptFilenameForSession(sessionId));
  const turnsFile = join(transcriptDirectoryPath, agentTurnsFilename(sessionId));
  const legacyTurnsFile = join(transcriptDirectoryPath, legacyAgentTurnsFilename(sessionId));
  const chatFile = join(transcriptDirectoryPath, chatFilename(sessionId));

  try {
    if (existsSync(chatFile)) {
      rmSync(chatFile);
    }
  } catch {}

  try {
    if (existsSync(transcriptFile)) {
      rmSync(transcriptFile);
    }
  } catch {}

  try {
    if (existsSync(turnsFile)) {
      rmSync(turnsFile);
    }
  } catch {}

  try {
    if (existsSync(legacyTurnsFile)) {
      rmSync(legacyTurnsFile);
    }
  } catch {}
};

export const deleteAllConversations = (transcriptDirectoryPath: string) => {
  if (!existsSync(transcriptDirectoryPath)) {
    return;
  }

  const files = readdirSync(transcriptDirectoryPath);

  for (const file of files) {
    if (
      file.endsWith(".jsonl") ||
      file.endsWith(".agent-turns.json") ||
      file.endsWith(".chat.json") ||
      file.endsWith(".claude-turns.json")
    ) {
      try {
        rmSync(join(transcriptDirectoryPath, file));
      } catch {}
    }
  }
};

const agentTurnsFilename = (sessionId: string) =>
  `${encodeURIComponent(sessionId)}.agent-turns.json`;

const chatFilename = (sessionId: string) => `${encodeURIComponent(sessionId)}.chat.json`;

const legacyAgentTurnsFilename = (sessionId: string) =>
  `${encodeURIComponent(sessionId)}.claude-turns.json`;

export const storeAgentTranscriptTurns = (
  transcriptDirectoryPath: string,
  sessionId: string,
  turns: ConversationTurn[],
) => {
  ensureTranscriptDirectory(transcriptDirectoryPath);
  const filePath = join(transcriptDirectoryPath, agentTurnsFilename(sessionId));
  writeFileSync(filePath, JSON.stringify(turns), "utf8");
};

export const storeChatMessages = (
  transcriptDirectoryPath: string,
  sessionId: string,
  messages: TranscriptMessage[],
) => {
  ensureTranscriptDirectory(transcriptDirectoryPath);
  writeFileSync(
    join(transcriptDirectoryPath, chatFilename(sessionId)),
    JSON.stringify(messages),
    "utf8",
  );
};

const turnsToChatMessages = (turns: ConversationTurn[]): TranscriptMessage[] =>
  turns.map((turn) => ({
    id: turn.turnId,
    role: turn.role,
    timestamp: turn.startedAt,
    blocks: [{ kind: "text", text: turn.content }],
  }));

/** Structured chat for a session. Falls back to flat turns for providers without a parsable transcript (OpenCode, Kiro). */
export const readChatMessages = (
  transcriptDirectoryPath: string,
  sessionId: string,
): TranscriptMessage[] | null => {
  const filePath = join(transcriptDirectoryPath, chatFilename(sessionId));

  if (existsSync(filePath)) {
    try {
      const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));

      if (Array.isArray(parsed)) {
        // SAFETY: file is only written by storeChatMessages, which serializes TranscriptMessage[].
        return parsed as TranscriptMessage[];
      }
    } catch {}
  }

  const turns = readAgentTranscriptTurns(transcriptDirectoryPath, sessionId);

  return turns && turns.length > 0 ? turnsToChatMessages(turns) : null;
};

const parseConversationTurn = (payload: ParsedValue): ConversationTurn | null => {
  const record = asRecord(payload);

  if (!record) {
    return null;
  }

  const turnId = asString(record.turnId);
  const role = record.role;
  const content = asString(record.content);
  const startedAt = asString(record.startedAt);
  const endedAt = asString(record.endedAt);

  if (
    !turnId ||
    (role !== "user" && role !== "assistant") ||
    content === null ||
    !startedAt ||
    !endedAt
  ) {
    return null;
  }

  return { turnId, role, content, startedAt, endedAt };
};

const readAgentTranscriptTurns = (
  transcriptDirectoryPath: string,
  sessionId: string,
): ConversationTurn[] | null => {
  const primaryPath = join(transcriptDirectoryPath, agentTurnsFilename(sessionId));
  const legacyPath = join(transcriptDirectoryPath, legacyAgentTurnsFilename(sessionId));
  const filePath = existsSync(primaryPath) ? primaryPath : legacyPath;

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed: ParsedValue = JSON.parse(raw);

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return null;
    }

    const turns = parsed
      .map((entry) => parseConversationTurn(entry))
      .filter((turn): turn is ConversationTurn => turn !== null);

    return turns.length > 0 ? turns : null;
  } catch {
    return null;
  }
};

/**
 * Adds one turn to the stored session turns without replacing them. Used when the agent's own
 * transcript cannot be read, so prompts and replies still accumulate across the whole session.
 */
export const appendAgentTranscriptTurn = (
  transcriptDirectoryPath: string,
  sessionId: string,
  role: ConversationTurn["role"],
  content: string,
) => {
  const text = content.trim();

  if (text.length === 0) {
    return;
  }

  const turns = readAgentTranscriptTurns(transcriptDirectoryPath, sessionId) ?? [];
  const lastTurn = turns[turns.length - 1];

  if (lastTurn?.role === role && lastTurn.content === text) {
    return;
  }

  const now = new Date().toISOString();

  turns.push({
    turnId: `turn-${turns.length + 1}`,
    role,
    content: text,
    startedAt: now,
    endedAt: now,
  });
  storeAgentTranscriptTurns(transcriptDirectoryPath, sessionId, turns);
};

const buildSearchSnippet = (content: string, query: string, contextChars = 80): string => {
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const matchIndex = lowerContent.indexOf(lowerQuery);

  if (matchIndex === -1) {
    return content
      .slice(0, contextChars * 2)
      .replace(/\s+/g, " ")
      .trim();
  }

  const start = Math.max(0, matchIndex - contextChars);
  const end = Math.min(content.length, matchIndex + query.length + contextChars);
  let snippet = content.slice(start, end).replace(/\s+/g, " ").trim();

  if (start > 0) snippet = `...${snippet}`;

  if (end < content.length) snippet = `${snippet}...`;

  return snippet;
};

export const searchConversations = (
  transcriptDirectoryPath: string,
  query: string,
): ConversationSearchResult => {
  if (!existsSync(transcriptDirectoryPath) || query.trim().length === 0) {
    return { query, hits: [] };
  }

  const lowerQuery = query.toLowerCase();
  const hits: ConversationSearchHit[] = [];

  const sessionIds = readdirSync(transcriptDirectoryPath)
    .map((filename) => parseSessionIdFromFilename(filename))
    .filter((sessionId): sessionId is string => sessionId !== null);

  for (const sessionId of sessionIds) {
    const turns = readAgentTranscriptTurns(transcriptDirectoryPath, sessionId) ?? [];

    for (const turn of turns) {
      if (turn.content.toLowerCase().includes(lowerQuery)) {
        hits.push({
          sessionId,
          turnId: turn.turnId,
          role: turn.role,
          snippet: buildSearchSnippet(turn.content, query),
          turnStartedAt: turn.startedAt,
        });
      }
    }
  }

  return { query, hits };
};

export const conversationExportMarkdown = (conversation: ConversationSessionDetail): string => {
  const lines: string[] = [];

  for (const turn of conversation.turns) {
    const roleLabel = turn.role === "user" ? "User" : "Assistant";
    lines.push(`## ${roleLabel}`);
    lines.push("");
    lines.push(turn.content.length > 0 ? turn.content : "(empty)");
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
};
