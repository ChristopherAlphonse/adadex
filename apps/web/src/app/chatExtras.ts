import type { DiffLine, TranscriptBlock, TranscriptMessage } from "@adadex/core";
import { asString, extractDiff } from "@adadex/core";

import type { TerminalView } from "./types";

type Session = TerminalView[number];

export type HandoverTone = "done" | "untested" | "needs-you";

export type HandoverPart = {
  key: string;
  text: string;
  tone: HandoverTone | null;
};

type HandoverMarker = "✅" | "🧪" | "❓";

const HANDOVER_MARKERS: Record<HandoverMarker, HandoverTone> = {
  "✅": "done",
  "🧪": "untested",
  "❓": "needs-you",
};

const isHandoverMarker = (value: string): value is HandoverMarker =>
  value === "✅" || value === "🧪" || value === "❓";

const NEEDS_YOU_STATES = new Set(["waiting_for_permission", "waiting_for_user"]);

/** Splits a reply into handover sections, so a marker at the start of a line colours that section. */
export const splitHandovers = (text: string): HandoverPart[] => {
  const parts: HandoverPart[] = [];

  for (const line of text.split("\n")) {
    const marker = Array.from(line.trimStart())[0];
    const tone = marker && isHandoverMarker(marker) ? HANDOVER_MARKERS[marker] : null;
    const current = parts[parts.length - 1];

    if (tone || !current) {
      parts.push({ key: `handover-${parts.length}`, text: line, tone });
    } else {
      current.text += `\n${line}`;
    }
  }

  return parts;
};

export type EditedFile = { path: string; added: number; removed: number; lines: DiffLine[] };

/** Edited files across any transcript blocks, so the file list can cover a whole session. */
export const collectEditedFiles = (blocks: TranscriptBlock[]): EditedFile[] => {
  const files = new Map<string, EditedFile>();

  for (const block of blocks) {
    if (block.kind !== "tool-call") continue;

    const diff = extractDiff(block.name, block.input);
    const path = asString(block.input.file_path) ?? asString(block.input.path);

    if (!diff || !path) continue;

    const file = files.get(path) ?? { path, added: 0, removed: 0, lines: [] };

    file.added += diff.lines.filter((line) => line.kind === "add").length;
    file.removed += diff.lines.filter((line) => line.kind === "del").length;
    file.lines.push(...diff.lines);
    files.set(path, file);
  }

  return [...files.values()];
};

export type ChatLink = { label: string; href: string };

const LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)]+)/g;

/** Links mentioned in a chat, deduplicated by URL. */
export const collectChatLinks = (messages: TranscriptMessage[]): ChatLink[] => {
  const links = new Map<string, ChatLink>();

  for (const message of messages) {
    for (const block of message.blocks) {
      if (block.kind !== "text") continue;

      for (const match of block.text.matchAll(LINK_PATTERN)) {
        const href = match[2] ?? match[3];

        if (href && !links.has(href)) {
          links.set(href, { href, label: match[1] || href });
        }
      }
    }
  }

  return [...links.values()].slice(0, 20);
};

export type ActivityGroup = {
  kind: "workers" | "tasks" | "subagents" | "background";
  label: string;
  sessions: Session[];
};

const labelOf = (session: Session): string =>
  session.coordinationName || session.label || session.terminalId;

/** The four counts above the chat, each backed by the sessions the operator can open. */
export const buildActivityGroups = (
  columns: Session[],
  selectedId: string | null,
): ActivityGroup[] => {
  const selected = columns.find((session) => session.terminalId === selectedId) ?? null;

  return [
    {
      kind: "workers",
      label: "Workers",
      sessions: selected
        ? columns.filter(
            (session) =>
              session.coordinationId === selected.coordinationId &&
              session.terminalId !== selected.terminalId &&
              session.parentTerminalId !== selected.terminalId,
          )
        : [],
    },
    {
      kind: "tasks",
      label: "Tasks",
      sessions: columns.filter((session) =>
        Boolean(session.agentRuntimeState && NEEDS_YOU_STATES.has(session.agentRuntimeState)),
      ),
    },
    {
      kind: "subagents",
      label: "Subagents",
      sessions: selected
        ? columns.filter((session) => session.parentTerminalId === selected.terminalId)
        : [],
    },
    {
      kind: "background",
      label: "Background",
      sessions: columns.filter(
        (session) =>
          session.agentRuntimeState === "processing" && session.terminalId !== selectedId,
      ),
    },
  ];
};

const lastUserText = (messages: TranscriptMessage[]): string | null => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message?.role !== "user") continue;

    const text = message.blocks
      .flatMap((block) => (block.kind === "text" ? [block.text] : []))
      .join(" ")
      .trim();

    if (text.length > 0) return text;
  }

  return null;
};

/** A catch-up built from live session state, with no model call or extra network request. */
export const buildCatchUp = (
  session: Session | null,
  messages: TranscriptMessage[] | null,
  activity: ActivityGroup[],
): string => {
  const countOf = (kind: ActivityGroup["kind"]): number =>
    activity.find((group) => group.kind === kind)?.sessions.length ?? 0;

  const request = lastUserText(messages ?? []);
  const files = collectEditedFiles((messages ?? []).flatMap((message) => message.blocks)).length;

  const parts = [
    session ? `${labelOf(session)} is ${session.agentRuntimeState ?? session.state}.` : null,
    request
      ? `Last request: ${request.length > 140 ? `${request.slice(0, 137)}...` : request}.`
      : null,
    files > 0 ? `${files} ${files === 1 ? "file" : "files"} changed in this session.` : null,
    countOf("subagents") > 0 ? `${countOf("subagents")} child agents.` : null,
    countOf("tasks") > 0 ? `${countOf("tasks")} agents need you.` : null,
    countOf("background") > 0 ? `${countOf("background")} agents working elsewhere.` : null,
  ].filter((part): part is string => part !== null);

  return parts.length > 0 ? parts.join(" ") : "Nothing to catch up on yet.";
};
