import type {
  DiffExtract,
  DiffLine,
  RequestUsage,
  TranscriptBlock,
  TranscriptMessage,
  UsageSummary,
} from "../domain/transcript";
import {
  type ParsedRecord,
  type ParsedValue,
  asNumber,
  asRecord,
  asString,
  isString,
} from "../util/typeCoercion";

export const DIFF_MAX_CHARS = 32_000;

export const DIFF_MAX_LINES = 120;

const SUBAGENT_TOOL_NAMES = new Set([
  "agent",
  "task",
  "spawn_agent",
  "send_message",
  "followup_task",
]);

export const isSubagentToolCall = (name: string): boolean =>
  SUBAGENT_TOOL_NAMES.has(name.toLowerCase());

const classifyPatchLine = (line: string): DiffLine => {
  if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("@@")) {
    return { kind: "meta", text: line };
  }

  if (line.startsWith("+")) {
    return { kind: "add", text: line };
  }

  if (line.startsWith("-")) {
    return { kind: "del", text: line };
  }

  return { kind: "context", text: line };
};

/** Drops the lines the old and new text share at the start and end, so only the real change is shown. */
const changedLines = (oldText: string, newText: string) => {
  const before = oldText.split("\n");
  const after = newText.split("\n");
  let start = 0;

  while (start < before.length && start < after.length && before[start] === after[start]) {
    start += 1;
  }

  let end = 0;

  while (
    end < before.length - start &&
    end < after.length - start &&
    before[before.length - 1 - end] === after[after.length - 1 - end]
  ) {
    end += 1;
  }

  return {
    old: before.slice(start, before.length - end).join("\n"),
    next: after.slice(start, after.length - end).join("\n"),
  };
};

const prefixedLines = (kind: "add" | "del", prefix: string, text: string): DiffLine[] =>
  text.split("\n").map((line) => ({ kind, text: `${prefix}${line}` }));

const capDiff = (lines: DiffLine[]): DiffExtract => {
  const kept: DiffLine[] = [];
  let chars = 0;

  for (const line of lines) {
    chars += line.text.length;

    if (kept.length >= DIFF_MAX_LINES || chars > DIFF_MAX_CHARS) {
      return { lines: kept, truncated: true };
    }

    kept.push(line);
  }

  return { lines: kept, truncated: false };
};

/** Diff lines for Edit/Write-style tool calls or a raw patch. Null when the call is not a file change. */
export const extractDiff = (name: string, input: ParsedRecord): DiffExtract | null => {
  const patch = asString(input.patch) ?? asString(input.diff);

  if (patch) {
    return capDiff(patch.split("\n").map(classifyPatchLine));
  }

  const lower = name.toLowerCase();
  const oldText = asString(input.old_string);
  const newText = asString(input.new_string);

  if (lower === "edit" && oldText !== null && newText !== null) {
    const changed = changedLines(oldText, newText);

    return capDiff([
      ...(changed.old === "" ? [] : prefixedLines("del", "-", changed.old)),
      ...(changed.next === "" ? [] : prefixedLines("add", "+", changed.next)),
    ]);
  }

  const content = asString(input.content);

  if (lower === "write" && content !== null) {
    return capDiff(prefixedLines("add", "+", content));
  }

  return null;
};

const resultText = (inner: ParsedValue | undefined): string => {
  if (isString(inner)) {
    return inner;
  }

  if (!Array.isArray(inner)) {
    return "";
  }

  return inner
    .map((part) => asString(asRecord(part)?.text) ?? "")
    .filter((text) => text.length > 0)
    .join("\n");
};

const blockFromRecord = (raw: ParsedRecord): TranscriptBlock | null => {
  const type = asString(raw.type);
  const id = asString(raw.id);
  const text = asString(raw.text);

  if (type === "text" && text !== null) {
    return { kind: "text", text };
  }

  const name = asString(raw.name);

  if (type === "tool_use" && id !== null && name !== null) {
    return { kind: "tool-call", toolUseId: id, name, input: asRecord(raw.input) ?? {} };
  }

  const toolUseId = asString(raw.tool_use_id);

  if (type === "tool_result" && toolUseId !== null) {
    return {
      kind: "tool-result",
      toolUseId,
      text: resultText(raw.content),
      isError: raw.is_error === true,
    };
  }

  if (type === "image") {
    return { kind: "image-ref", ref: id ?? "image" };
  }

  return null;
};

const toBlocks = (content: ParsedValue | undefined): TranscriptBlock[] => {
  if (isString(content)) {
    return content.length > 0 ? [{ kind: "text", text: content }] : [];
  }

  if (!Array.isArray(content)) {
    return [];
  }

  const blocks: TranscriptBlock[] = [];

  for (const part of content) {
    const record = asRecord(part);
    const block = record ? blockFromRecord(record) : null;

    if (block) {
      blocks.push(block);
    }
  }

  return blocks;
};

const parseJsonRecord = (line: string): ParsedRecord | null => {
  try {
    return asRecord(JSON.parse(line));
  } catch {
    return null;
  }
};

/** Pure parser: Claude Code JSONL text to structured chat messages. Tool-result-only entries become `tool` messages. */
export const parseClaudeTranscript = (jsonl: string): TranscriptMessage[] => {
  const messages: TranscriptMessage[] = [];

  for (const line of jsonl.split(/\r?\n/)) {
    const parsed = line.trim().length > 0 ? parseJsonRecord(line) : null;
    const type = parsed ? asString(parsed.type) : null;

    if (!parsed || (type !== "user" && type !== "assistant")) {
      continue;
    }

    const blocks = toBlocks((asRecord(parsed.message) ?? parsed).content);

    if (blocks.length === 0) {
      continue;
    }

    messages.push({
      id: asString(parsed.uuid) ?? `msg-${messages.length + 1}`,
      role: blocks.every((block) => block.kind === "tool-result") ? "tool" : type,
      timestamp: asString(parsed.timestamp),
      blocks,
    });
  }

  return messages;
};

const usageNumber = (value: ParsedValue | undefined): number => asNumber(value) ?? 0;

/** Pure: Claude Code JSONL text to a usage summary from each assistant message's `usage` block. */
export const summarizeClaudeUsage = (jsonl: string): UsageSummary => {
  const summary: UsageSummary = {
    model: null,
    requestCount: 0,
    contextTokens: 0,
    lastRequest: null,
    cacheHitRate: null,
    totalOutput: 0,
    firstAt: null,
    lastAt: null,
  };

  for (const line of jsonl.split(/\r?\n/)) {
    const parsed = line.trim().length > 0 ? parseJsonRecord(line) : null;
    const timestamp = parsed ? asString(parsed.timestamp) : null;

    if (timestamp) {
      summary.firstAt ??= timestamp;
      summary.lastAt = timestamp;
    }

    const message = parsed ? asRecord(parsed.message) : null;
    const usage = message ? asRecord(message.usage) : null;

    if (message && usage && asString(parsed?.type) === "assistant") {
      const request: RequestUsage = {
        input: usageNumber(usage.input_tokens),
        output: usageNumber(usage.output_tokens),
        cacheRead: usageNumber(usage.cache_read_input_tokens),
        cacheCreation: usageNumber(usage.cache_creation_input_tokens),
      };

      summary.model = asString(message.model) ?? summary.model;
      summary.requestCount += 1;
      summary.totalOutput += request.output;
      summary.lastRequest = request;
    }
  }

  if (summary.lastRequest) {
    const { input, cacheRead, cacheCreation } = summary.lastRequest;
    const total = input + cacheRead + cacheCreation;

    summary.contextTokens = total;
    summary.cacheHitRate = total > 0 ? cacheRead / total : null;
  }

  return summary;
};
