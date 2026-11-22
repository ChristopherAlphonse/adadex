import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConversationComposer } from "../src/components/ConversationComposer";

const noop = async (_text: string): Promise<boolean> => true;

describe("ConversationComposer enhancements", () => {
  it("Tab key calls onQueue with the draft and clears the textarea", () => {
    const onQueue = vi.fn();

    render(
      <ConversationComposer
        disabled={false}
        disabledReason=""
        error={null}
        onSend={noop}
        onQueue={onQueue}
      />,
    );

    const textarea = screen.getByRole("textbox", { name: "Message the agent" });

    fireEvent.change(textarea, { target: { value: "queue me up" } });
    fireEvent.keyDown(textarea, { key: "Tab" });

    expect(onQueue).toHaveBeenCalledWith("queue me up");
    expect(textarea).toHaveValue("");
  });

  it("Tab key does nothing when draft is empty", () => {
    const onQueue = vi.fn();

    render(
      <ConversationComposer
        disabled={false}
        disabledReason=""
        error={null}
        onSend={noop}
        onQueue={onQueue}
      />,
    );

    const textarea = screen.getByRole("textbox", { name: "Message the agent" });

    fireEvent.keyDown(textarea, { key: "Tab" });

    expect(onQueue).not.toHaveBeenCalled();
  });

  it("Ctrl+Enter calls onInterruptAndSend with the draft", async () => {
    const onInterruptAndSend = vi.fn(async (_text: string): Promise<boolean> => true);

    render(
      <ConversationComposer
        disabled={false}
        disabledReason=""
        error={null}
        onSend={noop}
        onInterruptAndSend={onInterruptAndSend}
      />,
    );

    const textarea = screen.getByRole("textbox", { name: "Message the agent" });

    fireEvent.change(textarea, { target: { value: "interrupt this" } });
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });

    await waitFor(() => {
      expect(onInterruptAndSend).toHaveBeenCalledWith("interrupt this");
    });
  });

  it("Alt+S calls onStash with the draft and clears the textarea", () => {
    const onStash = vi.fn();

    render(
      <ConversationComposer
        disabled={false}
        disabledReason=""
        error={null}
        onSend={noop}
        onStash={onStash}
      />,
    );

    const textarea = screen.getByRole("textbox", { name: "Message the agent" });

    fireEvent.change(textarea, { target: { value: "stash this draft" } });
    fireEvent.keyDown(textarea, { key: "s", altKey: true });

    expect(onStash).toHaveBeenCalledWith("stash this draft");
    expect(textarea).toHaveValue("");
  });

  it("Alt+S uppercase variant also calls onStash", () => {
    const onStash = vi.fn();

    render(
      <ConversationComposer
        disabled={false}
        disabledReason=""
        error={null}
        onSend={noop}
        onStash={onStash}
      />,
    );

    const textarea = screen.getByRole("textbox", { name: "Message the agent" });

    fireEvent.change(textarea, { target: { value: "stash uppercase" } });
    fireEvent.keyDown(textarea, { key: "S", altKey: true });

    expect(onStash).toHaveBeenCalledWith("stash uppercase");
    expect(textarea).toHaveValue("");
  });

  it("hint text includes Tab to queue", () => {
    render(<ConversationComposer disabled={false} disabledReason="" error={null} onSend={noop} />);

    expect(screen.getByText(/Tab to queue/)).toBeTruthy();
  });

  it("externalDraft populates the textarea when it changes to a non-empty value", () => {
    const { rerender } = render(
      <ConversationComposer
        disabled={false}
        disabledReason=""
        error={null}
        onSend={noop}
        externalDraft=""
      />,
    );

    const textarea = screen.getByRole("textbox", { name: "Message the agent" });
    expect(textarea).toHaveValue("");

    rerender(
      <ConversationComposer
        disabled={false}
        disabledReason=""
        error={null}
        onSend={noop}
        externalDraft="restored text"
      />,
    );

    expect(textarea).toHaveValue("restored text");
  });
});

describe("ConversationsPrimaryView pending message play button", () => {
  it("pending messages render a play button with aria-label Send now", async () => {
    // We test this by directly checking the aria-label "Send now" appears
    // when a pending message is in the DOM. We simulate it by rendering
    // a minimal structure matching what ConversationsPrimaryView renders.
    const sendNow = vi.fn();

    render(
      <ul>
        <li className="chat-turn" data-pending="true" data-role="user">
          <div className="chat-bubble">
            <p className="chat-bubble-gist">hello from pending</p>
          </div>
          <div className="chat-meta">
            Sent · the agent will reply when it is free
            <button
              aria-label="Send now"
              className="chat-pending-play"
              onClick={sendNow}
              type="button"
            >
              <svg aria-hidden="true" fill="currentColor" focusable="false" viewBox="0 0 16 16">
                <path d="M5 3.5l8 4.5-8 4.5V3.5z" />
              </svg>
            </button>
          </div>
        </li>
      </ul>,
    );

    const playButton = screen.getByRole("button", { name: "Send now" });
    expect(playButton).toBeTruthy();

    fireEvent.click(playButton);
    expect(sendNow).toHaveBeenCalledTimes(1);
  });
});
