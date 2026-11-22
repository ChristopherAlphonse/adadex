import type { TranscriptMessage } from "@adadex/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConversationChatThread } from "../src/components/ConversationChatThread";
import { ConversationTurnBubble } from "../src/components/ConversationTurnBubble";

const userRole = "user" as const;

const assistantRole = "assistant" as const;

const toolCallMessages: TranscriptMessage[] = [
  {
    id: "a1",
    role: "assistant",
    timestamp: null,
    blocks: [
      { kind: "text", text: "Working on it" },
      {
        kind: "tool-call",
        toolUseId: "tc1",
        name: "Bash",
        input: { command: "ls" },
      },
    ],
  },
  {
    id: "u1",
    role: "tool",
    timestamp: null,
    blocks: [{ kind: "tool-result", toolUseId: "tc1", text: "file.ts", isError: false }],
  },
];

describe("ConversationTurnBubble reading enhancements", () => {
  it("(a) shows the message actions trigger button on hover", () => {
    const { container } = render(
      <ConversationTurnBubble
        role={userRole}
        content="Hello there"
        startedAt="2024-01-01T00:00:00Z"
        showSender={false}
        highlighted={false}
        highlightTerm={undefined}
        turnId="t1"
      />,
    );

    const li = container.querySelector("li.chat-turn");
    expect(li).toBeTruthy();

    // The trigger button should be in the DOM (hidden via CSS, but present)
    const trigger = screen.getByRole("button", { name: "Message actions" });
    expect(trigger).toBeTruthy();
  });

  it("(d) shows Fork from here when role is assistant and onFork is set", () => {
    const onFork = vi.fn();

    render(
      <ConversationTurnBubble
        role={assistantRole}
        content="I can help"
        startedAt="2024-01-01T00:00:00Z"
        showSender={false}
        highlighted={false}
        highlightTerm={undefined}
        turnId="t2"
        onFork={onFork}
      />,
    );

    // Open the menu
    const trigger = screen.getByRole("button", { name: "Message actions" });
    fireEvent.click(trigger);

    // Fork from here should appear for assistant role
    expect(screen.getByRole("button", { name: "Fork from here" })).toBeTruthy();
  });

  it("(e) does NOT show Fork from here when role is user", () => {
    const onFork = vi.fn();

    render(
      <ConversationTurnBubble
        role={userRole}
        content="User message"
        startedAt="2024-01-01T00:00:00Z"
        showSender={false}
        highlighted={false}
        highlightTerm={undefined}
        turnId="t3"
        onFork={onFork}
      />,
    );

    // Open the menu
    const trigger = screen.getByRole("button", { name: "Message actions" });
    fireEvent.click(trigger);

    // Fork from here must NOT appear for user role
    expect(screen.queryByRole("button", { name: "Fork from here" })).toBeNull();
  });

  it("shows Rewind to here only for user messages when onRewind is provided", () => {
    const onRewind = vi.fn();

    render(
      <ConversationTurnBubble
        role={userRole}
        content="User message"
        startedAt="2024-01-01T00:00:00Z"
        showSender={false}
        highlighted={false}
        highlightTerm={undefined}
        turnId="t4"
        onRewind={onRewind}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Message actions" });
    fireEvent.click(trigger);

    expect(screen.getByRole("button", { name: "Rewind to here" })).toBeTruthy();
  });

  it("always shows Copy and Save as Markdown in the menu", () => {
    render(
      <ConversationTurnBubble
        role={userRole}
        content="Some content"
        startedAt="2024-01-01T00:00:00Z"
        showSender={false}
        highlighted={false}
        highlightTerm={undefined}
        turnId="t5"
      />,
    );

    const trigger = screen.getByRole("button", { name: "Message actions" });
    fireEvent.click(trigger);

    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save as Markdown" })).toBeTruthy();
  });
});

describe("ConversationChatThread viewMode", () => {
  it("(b) hides WorkSummary in summary viewMode", () => {
    render(<ConversationChatThread messages={toolCallMessages} viewMode="summary" />);

    // "Worked" is the text inside WorkSummary - should not appear
    expect(screen.queryByText("Worked")).toBeNull();
  });

  it("(c) WorkSummary details element has open attribute in detailed viewMode", () => {
    const { container } = render(
      <ConversationChatThread messages={toolCallMessages} viewMode="detailed" />,
    );

    const details = container.querySelector("details");
    expect(details).toBeTruthy();
    // The open attribute should be set
    expect(details?.hasAttribute("open")).toBe(true);
  });

  it("renders WorkSummary normally in quiet viewMode", () => {
    render(<ConversationChatThread messages={toolCallMessages} viewMode="quiet" />);

    expect(screen.getByText("Worked")).toBeTruthy();
  });
});
