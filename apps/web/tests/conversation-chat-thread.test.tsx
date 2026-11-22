import type { TranscriptMessage } from "@adadex/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConversationChatThread } from "../src/components/ConversationChatThread";

const messages: TranscriptMessage[] = [
  {
    id: "a1",
    role: "assistant",
    timestamp: null,
    blocks: [
      { kind: "text", text: "Editing now" },
      {
        kind: "tool-call",
        toolUseId: "t1",
        name: "Edit",
        input: { file_path: "a.ts", old_string: "foo", new_string: "bar" },
      },
      { kind: "tool-call", toolUseId: "t2", name: "Task", input: { description: "dig" } },
    ],
  },
  {
    id: "u1",
    role: "tool",
    timestamp: null,
    blocks: [{ kind: "tool-result", toolUseId: "t1", text: "done", isError: false }],
  },
];

describe("ConversationChatThread", () => {
  it("renders tool calls with diff, sub-agent chip, and hides tool-result messages", () => {
    const { container } = render(<ConversationChatThread messages={messages} />);

    expect(screen.getByText("Editing now")).toBeTruthy();
    expect(screen.getByText("sub-agent")).toBeTruthy();
    expect(container.querySelector('[data-kind="del"]')?.textContent).toContain("-foo");
    expect(container.querySelector('[data-kind="add"]')?.textContent).toContain("+bar");
    expect(container.querySelectorAll("li")).toHaveLength(1);
  });
});
