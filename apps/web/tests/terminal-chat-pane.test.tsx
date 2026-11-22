import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TerminalChatPane } from "../src/components/TerminalChatPane";

vi.mock("../src/components/Terminal", () => ({
  Terminal: ({ terminalId }: { terminalId: string }) => <div>raw terminal {terminalId}</div>,
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

const stubChat = (messages: unknown[] | null) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      messages
        ? new Response(JSON.stringify({ messages }), { status: 200 })
        : new Response("{}", { status: 404 }),
    ),
  );
};

describe("TerminalChatPane", () => {
  it("starts on the terminal and switches to the chat of the same session", async () => {
    stubChat([
      {
        id: "a1",
        role: "assistant",
        timestamp: null,
        blocks: [{ kind: "text", text: "all done" }],
      },
    ]);
    render(<TerminalChatPane terminalId="s1" />);

    expect(screen.getByText("raw terminal s1")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Chat" }));

    await waitFor(() => {
      expect(screen.getByText("all done")).toBeTruthy();
    });
    expect(screen.queryByText("raw terminal s1")).toBeNull();
  });

  it("explains when there is no chat yet, and switches back to the terminal", async () => {
    stubChat(null);
    render(<TerminalChatPane terminalId="s2" />);

    fireEvent.click(screen.getByRole("button", { name: "Chat" }));
    expect(screen.getByText(/No chat yet/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Terminal" }));
    expect(screen.getByText("raw terminal s2")).toBeTruthy();
  });
});
