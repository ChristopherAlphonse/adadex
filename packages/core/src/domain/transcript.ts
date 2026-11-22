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
