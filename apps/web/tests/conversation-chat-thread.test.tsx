import type { TranscriptMessage } from "@adadex/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

  it("renders a questions block as a card and sends the answers", async () => {
    const onSendAnswer = vi.fn(async (_text: string) => {});

    const withForm: TranscriptMessage[] = [
      {
        id: "a9",
        role: "assistant",
        timestamp: null,
        blocks: [
          {
            kind: "text",
            text: 'Quick check.\n```questions\n{"title":"Pick one","questions":[{"text":"Which?","options":[{"label":"Red","recommended":true},{"label":"Blue"}]}]}\n```',
          },
        ],
      },
    ];

    render(<ConversationChatThread messages={withForm} onSendAnswer={onSendAnswer} />);
    expect(screen.getByText("Quick check.")).toBeTruthy();
    expect(screen.getByText("Which?")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Send answers" }));
    await waitFor(() => {
      expect(onSendAnswer).toHaveBeenCalledWith(expect.stringContaining("q1 (Which?): Red"));
    });
  });

  it("shows a form as answered when its answer is already in the conversation", () => {
    const history: TranscriptMessage[] = [
      {
        id: "a1",
        role: "assistant",
        timestamp: null,
        blocks: [
          {
            kind: "text",
            text: '```questions\n{"title":"Pick one","questions":[{"text":"Which?","options":[{"label":"Red"}]}]}\n```',
          },
        ],
      },
      {
        id: "u1",
        role: "user",
        timestamp: null,
        blocks: [{ kind: "text", text: 'Answers to "Pick one":\nq1 (Which?): Red' }],
      },
    ];

    render(<ConversationChatThread messages={history} onSendAnswer={async () => {}} />);
    expect(screen.getByText("Answers sent.")).toBeTruthy();
  });
});
