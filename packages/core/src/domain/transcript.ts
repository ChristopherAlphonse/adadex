import type { ParsedRecord } from "../util/typeCoercion";

export type TranscriptRole = "user" | "assistant" | "reasoning" | "tool" | "system";

export type TranscriptBlock =
  | { kind: "text"; text: string }
  | { kind: "tool-call"; toolUseId: string; name: string; input: ParsedRecord }
  | { kind: "tool-result"; toolUseId: string; text: string; isError: boolean }
  | { kind: "image-ref"; ref: string };

export type TranscriptMessage = {
  id: string;
  role: TranscriptRole;
  timestamp: string | null;
  blocks: TranscriptBlock[];
};

export type DiffLineKind = "add" | "del" | "meta" | "context";

export type DiffLine = { kind: DiffLineKind; text: string };

export type DiffExtract = { lines: DiffLine[]; truncated: boolean };

/** Token counts of one model request. */
export type RequestUsage = {
  input: number;
  output: number;
  cacheRead: number;
  cacheCreation: number;
};

/** What a session's transcript says about its model use. Null fields mean the transcript had no request yet. */
export type UsageSummary = {
  model: string | null;
  requestCount: number;
  /** Tokens the last request sent to the model: new input plus everything read from or written to the cache. */
  contextTokens: number;
  lastRequest: RequestUsage | null;
  /** Share of the last request's input that came from the cache, 0 to 1. */
  cacheHitRate: number | null;
  totalOutput: number;
  firstAt: string | null;
  lastAt: string | null;
};

export type QuestionOption = {
  label: string;
  detail: string | null;
  recommended: boolean;
};

export type Question = {
  id: string;
  text: string;
  options: QuestionOption[];
};

/** A set of questions an agent asks the user, written by the agent as a fenced `questions` block. */
export type QuestionForm = {
  title: string;
  questions: Question[];
};

export type MessageSegment = { kind: "text"; text: string } | { kind: "form"; form: QuestionForm };
