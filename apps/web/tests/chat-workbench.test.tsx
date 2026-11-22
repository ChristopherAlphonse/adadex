import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TerminalView } from "../src/app/types";
import { type ChatWorkbenchPanel, ChatWorkbench } from "../src/components/agents/ChatWorkbench";

vi.mock("../src/app/sendChannelMessage", () => ({
  sendChannelMessage: vi.fn(async () => {}),
}));

vi.mock("../src/app/hooks/useSessionStats", () => ({ useSessionStats: () => null }));

const { sendChannelMessage } = await import("../src/app/sendChannelMessage");

const sendMessageMock = vi.mocked(sendChannelMessage);

const session = (overrides: Partial<TerminalView[number]>): TerminalView[number] => ({
  terminalId: "t1",
  label: "t1",
  state: "live",
  coordinationId: "c1",
  coordinationName: "Parser work",
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const Harness = ({
  onSelectSession = vi.fn(),
  onBringBack = vi.fn(),
}: {
  onSelectSession?: (id: string) => void;
  onBringBack?: (text: string) => void;
}) => {
  const [panel, setPanel] = useState<ChatWorkbenchPanel | null>(null);
  const [draft, setDraft] = useState("");

  return (
    <ChatWorkbench
      columns={[
        session({ terminalId: "t1" }),
        session({
          terminalId: "t2",
          label: "t2",
          coordinationName: "Reviewer work",
          agentRuntimeState: "idle",
        }),
      ]}
      messages={null}
      onBringBack={onBringBack}
      onPanelChange={setPanel}
      onScrollToBottom={vi.fn()}
      onSelectSession={onSelectSession}
      onSideChatDraftChange={setDraft}
      panel={panel}
      session={session({ terminalId: "t1", agentRuntimeState: "idle" })}
      sideChatDraft={draft}
    />
  );
};

afterEach(() => {
  sendMessageMock.mockClear();
});

describe("ChatWorkbench", () => {
  it("opens a worker from its activity pill", () => {
    const onSelectSession = vi.fn();

    render(<Harness onSelectSession={onSelectSession} />);

    fireEvent.click(screen.getByRole("button", { name: "Workers, 1" }));
    fireEvent.click(screen.getByRole("button", { name: /Reviewer work · idle/ }));

    expect(onSelectSession).toHaveBeenCalledWith("t2");
  });

  it("sends a side question, brings it back and hands off the session", async () => {
    const onBringBack = vi.fn();

    render(<Harness onBringBack={onBringBack} />);

    fireEvent.click(screen.getByRole("button", { name: "Side chat" }));
    fireEvent.change(screen.getByLabelText("Side chat agent"), { target: { value: "t2" } });
    fireEvent.change(screen.getByLabelText("Side chat message"), {
      target: { value: "Review the parser" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledWith("t2", "[Side chat from t1]: Review the parser");
    });

    fireEvent.click(screen.getByRole("button", { name: "Bring back" }));
    expect(onBringBack).toHaveBeenCalledWith("Review the parser");

    fireEvent.click(screen.getByRole("button", { name: "Hand off this session" }));
    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledWith(
        "t2",
        expect.stringContaining("/api/conversations/t1/export?format=md"),
      );
    });
  });

  it("shows a catch-up from live state", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Catch me up" }));

    expect(screen.getByText("Parser work is idle.")).toBeTruthy();
    expect(screen.getByText(/No model call/)).toBeTruthy();
  });
});
