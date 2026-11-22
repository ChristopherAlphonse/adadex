import type {
  MessageSegment,
  VisualCard,
  VisualChart,
  VisualTable,
  VisualTile,
} from "../domain/transcript";
import { type ParsedValue, asNumber, asRecord, asString } from "../util/typeCoercion";
import { splitQuestionForms } from "./questionForm";

const MAX_TILES = 8;

const MAX_POINTS = 60;

const MAX_ROWS = 100;

const MAX_COLUMNS = 12;

const VISUAL_FENCE = /```visual[ \t]*\r?\n([\s\S]*?)```/g;

const text = (value: ParsedValue | undefined): string | null => {
  const asText = asString(value);

  if (asText !== null) {
    return asText;
  }

  const asNum = asNumber(value);

  return asNum === null ? null : String(asNum);
};

const parseTile = (value: ParsedValue): VisualTile[] => {
  const record = asRecord(value);
  const label = record ? text(record.label) : null;
  const tileValue = record ? text(record.value) : null;

  return record && label && tileValue !== null
    ? [{ label, value: tileValue, detail: asString(record.detail) }]
    : [];
};

const parseChart = (value: ParsedValue | undefined): VisualChart | null => {
  const record = asRecord(value);

  if (!record || !Array.isArray(record.labels) || !Array.isArray(record.values)) {
    return null;
  }

  const kind = record.kind === "line" ? "line" : "bar";
  const labels = record.labels.slice(0, MAX_POINTS).map((label) => text(label) ?? "");
  const values = record.values.slice(0, MAX_POINTS).map((point) => asNumber(point) ?? 0);
  const count = Math.min(labels.length, values.length);

  return count > 0
    ? {
        kind,
        title: asString(record.title),
        labels: labels.slice(0, count),
        values: values.slice(0, count),
      }
    : null;
};

const parseTable = (value: ParsedValue | undefined): VisualTable | null => {
  const record = asRecord(value);

  if (!record || !Array.isArray(record.columns) || !Array.isArray(record.rows)) {
    return null;
  }

  const columns = record.columns.slice(0, MAX_COLUMNS).map((column) => text(column) ?? "");

  const rows = record.rows
    .slice(0, MAX_ROWS)
    .flatMap((row) =>
      Array.isArray(row) ? [columns.map((_, index) => text(row[index]) ?? "")] : [],
    );

  return columns.length > 0 ? { columns, rows } : null;
};

const parseVisual = (body: string): VisualCard | null => {
  let record: ReturnType<typeof asRecord>;

  try {
    record = asRecord(JSON.parse(body));
  } catch {
    return null;
  }

  if (!record) {
    return null;
  }

  const tiles = Array.isArray(record.tiles)
    ? record.tiles.slice(0, MAX_TILES).flatMap(parseTile)
    : [];

  const chart = parseChart(record.chart);
  const table = parseTable(record.table);

  return tiles.length > 0 || chart || table
    ? { title: asString(record.title), tiles, chart, table }
    : null;
};

/** Splits plain text around `visual` blocks. A block that is not valid, or has nothing to draw, stays text. */
const splitVisualBlocks = (source: string): MessageSegment[] => {
  const segments: MessageSegment[] = [];
  let cursor = 0;

  for (const match of source.matchAll(VISUAL_FENCE)) {
    const visual = parseVisual(match[1] ?? "");
    const start = match.index ?? 0;

    if (visual) {
      const before = source.slice(cursor, start);

      if (before.trim().length > 0) {
        segments.push({ kind: "text", text: before });
      }

      segments.push({ kind: "visual", visual });
      cursor = start + match[0].length;
    }
  }

  const rest = source.slice(cursor);

  if (rest.trim().length > 0 || segments.length === 0) {
    segments.push({ kind: "text", text: rest });
  }

  return segments;
};

/** One message split into plain text, question forms and visual cards, in reading order. */
export const splitMessageSegments = (message: string): MessageSegment[] =>
  splitQuestionForms(message).flatMap((segment) =>
    segment.kind === "text" ? splitVisualBlocks(segment.text) : [segment],
  );
