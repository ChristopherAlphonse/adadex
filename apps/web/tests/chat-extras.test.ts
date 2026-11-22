import type { TranscriptMessage } from "@adadex/core";
import { describe, expect, it } from "vitest";

import {
  buildActivityGroups,
  buildCatchUp,
  collectChatLinks,
  collectEditedFiles,
  splitHandovers,
} from "../src/app/chatExtras";
import type { TerminalView } from "../src/app/types";

const session = (overrides: Partial<TerminalView[number]>): TerminalView[number] => ({
  terminalId: "t1",
  label: "t1",
  state: "live",
  coordinationId: "c1",
  coordinationName: "Parser work",
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const message = (role: "user" | "assistant", text: string): TranscriptMessage => ({
  id: `${role}-${text.length}`,
  role,
  timestamp: null,
  blocks: [{ kind: "text", text }],
});

describe("splitHandovers", () => {
  it("labels marked sections and keeps following lines with them", () => {
    expect(splitHandovers("Intro\n✅ Done\nTests pass\n❓ Needs you\nWhich branch?")).toEqual([
      { key: "handover-0", text: "Intro", tone: null },
      { key: "handover-1", text: "✅ Done\nTests pass", tone: "done" },
      { key: "handover-2", text: "❓ Needs you\nWhich branch?", tone: "needs-you" },
    ]);
  });

  it("leaves an ordinary reply as one section", () => {
    expect(splitHandovers("plain text\nmore text")).toHaveLength(1);
  });
});

describe("collectEditedFiles", () => {
  it("adds up edits for the same file across tool calls", () => {
    const files = collectEditedFiles([
      {
        kind: "tool-call",
        toolUseId: "a",
        name: "Write",
        input: {
          file_path: "src/a.ts",
          content: "old\nnew",
          old_content: "old\ngone",
        },
      },
    ]);

    expect(files).toHaveLength(1);
    expect(files[0]?.path).toBe("src/a.ts");
    expect(files[0]?.added).toBeGreaterThan(0);
  });
});

describe("collectChatLinks", () => {
  it("collects markdown and bare links once each", () => {
    const links = collectChatLinks([
      message("assistant", "See [docs](https://example.com/docs) and https://example.com/docs"),
    ]);

    expect(links).toEqual([{ href: "https://example.com/docs", label: "docs" }]);
  });
});

describe("buildActivityGroups", () => {
  it("groups workers, tasks, children and background agents around the selection", () => {
    const groups = buildActivityGroups(
      [
        session({ terminalId: "t1" }),
        session({ terminalId: "t2" }),
        session({
          terminalId: "t3",
          parentTerminalId: "t1",
          agentRuntimeState: "processing",
        }),
        session({ terminalId: "t4", coordinationId: "c2", agentRuntimeState: "waiting_for_user" }),
      ],
      "t1",
    );

    const ids = (kind: string) =>
      groups.find((group) => group.kind === kind)?.sessions.map((item) => item.terminalId);

    expect(ids("workers")).toEqual(["t2"]);
    expect(ids("subagents")).toEqual(["t3"]);
    expect(ids("tasks")).toEqual(["t4"]);
    expect(ids("background")).toEqual(["t3"]);
  });
});

describe("buildCatchUp", () => {
  it("summarises the last request and the agents that need attention", () => {
    const summary = buildCatchUp(
      session({ terminalId: "t1", agentRuntimeState: "idle" }),
      [message("user", "Fix the parser")],
      buildActivityGroups(
        [
          session({ terminalId: "t1" }),
          session({ terminalId: "t2", agentRuntimeState: "waiting_for_permission" }),
        ],
        "t1",
      ),
    );

    expect(summary).toContain("Parser work is idle.");
    expect(summary).toContain("Last request: Fix the parser.");
    expect(summary).toContain("1 agents need you.");
  });
});
