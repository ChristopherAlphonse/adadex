import { describe, expect, it } from "vitest";

import {
  DIFF_MAX_LINES,
  extractDiff,
  isSubagentToolCall,
  parseClaudeTranscript,
  summarizeClaudeUsage,
} from "../src";

describe("transcript rules", () => {
  it("detects sub-agent tools", () => {
    expect(isSubagentToolCall("Task")).toBe(true);
    expect(isSubagentToolCall("Bash")).toBe(false);
  });

  it("builds an Edit diff", () => {
    const d = extractDiff("Edit", { old_string: "a", new_string: "b" });
    expect(d?.lines.map((l) => l.kind)).toEqual(["del", "add"]);
  });

  it("shows only the changed lines of an Edit", () => {
    const d = extractDiff("Edit", {
      old_string: "keep\nold\nend",
      new_string: "keep\nnew one\nnew two\nend",
    });

    expect(d?.lines.map((l) => l.text)).toEqual(["-old", "+new one", "+new two"]);
  });

  it("caps long diffs", () => {
    const d = extractDiff("Write", { content: "x\n".repeat(500) });
    expect(d?.lines).toHaveLength(DIFF_MAX_LINES);
    expect(d?.truncated).toBe(true);
  });

  it("parses tool calls and results", () => {
    const jsonl = [
      JSON.stringify({
        type: "assistant",
        message: {
          content: [{ type: "tool_use", id: "t1", name: "Bash", input: { command: "ls" } }],
        },
      }),
      JSON.stringify({
        type: "user",
        message: { content: [{ type: "tool_result", tool_use_id: "t1", content: "ok" }] },
      }),
      "not json",
    ].join("\n");

    const msgs = parseClaudeTranscript(jsonl);

    expect(msgs.map((m) => m.role)).toEqual(["assistant", "tool"]);
    expect(msgs[1]?.blocks[0]).toMatchObject({ kind: "tool-result", toolUseId: "t1", text: "ok" });
  });
});

describe("summarizeClaudeUsage", () => {
  const line = (usage: Record<string, number>, at: string) =>
    JSON.stringify({
      type: "assistant",
      timestamp: at,
      message: { model: "claude-sonnet-5-5", usage, content: [] },
    });

  it("takes context and cache rate from the last request and sums output", () => {
    const jsonl = [
      line({ input_tokens: 10, output_tokens: 5 }, "2026-11-22T06:00:00.000Z"),
      "not json",
      line(
        {
          input_tokens: 2,
          output_tokens: 100,
          cache_read_input_tokens: 90,
          cache_creation_input_tokens: 8,
        },
        "2026-11-22T06:01:00.000Z",
      ),
    ].join("\n");

    const summary = summarizeClaudeUsage(jsonl);

    expect(summary.model).toBe("claude-sonnet-5-5");
    expect(summary.requestCount).toBe(2);
    expect(summary.contextTokens).toBe(100);
    expect(summary.cacheHitRate).toBeCloseTo(0.9);
    expect(summary.totalOutput).toBe(105);
    expect(summary.firstAt).toBe("2026-11-22T06:00:00.000Z");
    expect(summary.lastAt).toBe("2026-11-22T06:01:00.000Z");
  });

  it("is empty before any request", () => {
    const summary = summarizeClaudeUsage("");

    expect(summary.lastRequest).toBeNull();
    expect(summary.cacheHitRate).toBeNull();
    expect(summary.requestCount).toBe(0);
  });
});
