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
  it("groups tool calls into one work summary with an edited-files card", () => {
    const { container } = render(<ConversationChatThread messages={messages} />);

    expect(screen.getByText("Editing now")).toBeTruthy();
    expect(screen.getByText("Worked")).toBeTruthy();
    expect(screen.getByText("2 tool calls")).toBeTruthy();
    expect(screen.getByText("1 file")).toBeTruthy();
    expect(screen.getByText("Edited 1 file")).toBeTruthy();
    expect(screen.getByText("sub-agent")).toBeTruthy();
    expect(container.textContent).toContain("-foo");
    expect(container.textContent).toContain("+bar");
  });

  it("shows how long the agent worked when timestamps are present", () => {
    const timed = messages.map((message, index) => ({
      ...message,
      timestamp: `2026-11-22T00:00:0${index * 9}.000Z`,
    }));

    render(<ConversationChatThread messages={timed} />);
    expect(screen.getByText("Worked 9s")).toBeTruthy();
  });

  it("puts each user message in its own turn", () => {
    const withUser: TranscriptMessage[] = [
      { id: "u0", role: "user", timestamp: null, blocks: [{ kind: "text", text: "fix it" }] },
      ...messages,
    ];

    const { container } = render(<ConversationChatThread messages={withUser} />);

    expect(screen.getByText("fix it")).toBeTruthy();
    expect(container.querySelectorAll('li[data-role="user"]')).toHaveLength(1);
    expect(container.querySelectorAll('li[data-role="assistant"]')).toHaveLength(1);
  });
});
