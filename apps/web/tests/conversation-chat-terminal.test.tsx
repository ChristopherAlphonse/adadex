import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TerminalChatPane } from "../src/components/TerminalChatPane";

// Mock the Terminal component so it does not try to open a WebSocket
vi.mock("../src/components/Terminal", () => ({
  Terminal: ({ terminalId }: { terminalId: string }) => (
    <div data-testid="mock-terminal">terminal {terminalId}</div>
  ),
}));

// Mock useConversationChat – TerminalChatPane's ChatView uses it
vi.mock("../src/app/hooks/useConversationChat", () => ({
  useConversationChat: () => [],
}));

describe("TerminalChatPane Chat/Terminal mode toggle", () => {
  it("renders the Terminal mode by default", () => {
    render(<TerminalChatPane terminalId="session-abc" />);

    expect(screen.getByTestId("mock-terminal")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Terminal" })).toBeTruthy();
  });

  it("switches to Chat view when the Chat button is clicked", () => {
    render(<TerminalChatPane terminalId="session-abc" />);

    // Terminal mock should be visible initially
    expect(screen.getByTestId("mock-terminal")).toBeTruthy();

    // Click the Chat button
    fireEvent.click(screen.getByRole("button", { name: "Chat" }));

    // Terminal mock is gone; chat content is shown instead
    expect(screen.queryByTestId("mock-terminal")).toBeNull();
    // The chat view renders a "No chat yet" paragraph or the message input
    expect(screen.getByRole("textbox", { name: "Message the agent" })).toBeTruthy();
  });

  it("switches back to Terminal when Terminal button is clicked after switching to Chat", () => {
    render(<TerminalChatPane terminalId="session-xyz" />);

    fireEvent.click(screen.getByRole("button", { name: "Chat" }));
    expect(screen.queryByTestId("mock-terminal")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Terminal" }));
    expect(screen.getByTestId("mock-terminal")).toBeTruthy();
  });
});

// The model pill and its Alt+P shortcut are covered against the real
// ConversationsPrimaryView in conversations-stop-and-model.test.tsx.
