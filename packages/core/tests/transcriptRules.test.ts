import { describe, expect, it } from "vitest";

import { DIFF_MAX_LINES, extractDiff, isSubagentToolCall, parseClaudeTranscript } from "../src";

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
