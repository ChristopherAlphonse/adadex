import type { ConversationSessionDetail, ConversationTurn, TranscriptMessage } from "@adadex/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConversationsPrimaryView } from "../src/components/ConversationsPrimaryView";

type RuntimeState = {
  sessions: ConversationSessionDetail[];
  selectedSessionId: string | null;
  selectedSession: ConversationSessionDetail | null;
  chatMessages: TranscriptMessage[] | null;
  sendMessage: ReturnType<typeof vi.fn>;
};

const runtime: RuntimeState = vi.hoisted(() => ({
  sessions: [],
  selectedSessionId: null,
  selectedSession: null,
  chatMessages: null,
  sendMessage: vi.fn(),
}));

vi.mock("../src/app/hooks/useConversationsRuntime", () => ({
  useConversationsRuntime: () => ({
    sessions: runtime.sessions,
    selectedSessionId: runtime.selectedSessionId,
    selectedSession: runtime.selectedSession,
    isLoadingSessions: false,
    isLoadingSelectedSession: false,
    isExporting: false,
    isClearing: false,
    isDeleting: false,
    isSearching: false,
    searchQuery: "",
    searchHits: [],
    highlightedTurnId: null,
    errorMessage: null,
    selectSession: vi.fn(),
    refreshSelectedSession: vi.fn(async () => undefined),
    sendMessage: runtime.sendMessage,
    refreshSessions: vi.fn(async () => undefined),
    clearAllSessions: vi.fn(async () => undefined),
    deleteSession: vi.fn(async () => undefined),
    exportSession: vi.fn(async () => null),
    searchConversations: vi.fn(async () => undefined),
    clearSearch: vi.fn(),
    navigateToSearchHit: vi.fn(),
  }),
}));

vi.mock("../src/app/hooks/useConversationChat", () => ({
  useConversationChat: () => runtime.chatMessages,
}));

vi.mock("../src/components/TerminalChatPane", () => ({
  TerminalChatPane: ({ terminalId }: { terminalId: string }) => (
    <div data-testid="mock-terminal">{terminalId}</div>
  ),
}));

const turns: ConversationTurn[] = [
  {
    turnId: "t-user",
    role: "user",
    content: "Do the thing",
    startedAt: "2026-11-22T10:00:00.000Z",
    endedAt: "2026-11-22T10:00:01.000Z",
  },
  {
    turnId: "t-agent",
    role: "assistant",
    content: "Done",
    startedAt: "2026-11-22T10:01:00.000Z",
    endedAt: "2026-11-22T10:01:05.000Z",
  },
];

const makeSession = (
  sessionId: string,
  sessionTurns: ConversationTurn[],
): ConversationSessionDetail => ({
  sessionId,
  coordinationId: null,
  startedAt: "2026-11-22T10:00:00.000Z",
  endedAt: null,
  lastEventAt: "2026-11-22T10:01:05.000Z",
  eventCount: sessionTurns.length * 2,
  turnCount: sessionTurns.length,
  userTurnCount: sessionTurns.filter((turn) => turn.role === "user").length,
  assistantTurnCount: sessionTurns.filter((turn) => turn.role === "assistant").length,
  firstUserTurnPreview: "Do the thing",
  lastUserTurnPreview: "Do the thing",
  lastAssistantTurnPreview: "Done",
  turns: sessionTurns,
  events: [],
});

const activateSession = (sessionId: string, sessionTurns: ConversationTurn[]) => {
  const session = makeSession(sessionId, sessionTurns);

  runtime.selectedSessionId = sessionId;
  runtime.selectedSession = session;
  runtime.sessions = [session];
};

const composer = () => screen.getByRole("textbox", { name: "Message the agent" });

beforeEach(() => {
  runtime.chatMessages = null;
  runtime.sendMessage.mockClear();
  activateSession("s1", turns);
});

describe("ConversationsPrimaryView review fixes", () => {
  it("passes turn ids from the parent into Rewind and Fork menu actions", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      render(<ConversationsPrimaryView enabled={false} />);

      const [rewindTrigger, forkTrigger] = screen.getAllByRole("button", {
        name: "Message actions",
      });

      if (!rewindTrigger || !forkTrigger) throw new Error("expected two message action menus");

      fireEvent.click(rewindTrigger);
      fireEvent.click(screen.getByRole("button", { name: "Rewind to here" }));
      expect(warn).toHaveBeenCalledWith("Rewind to here not yet implemented for turn", "t-user");

      fireEvent.click(forkTrigger);
      fireEvent.click(screen.getByRole("button", { name: "Fork from here" }));
      expect(warn).toHaveBeenCalledWith("Fork from here not yet implemented for turn", "t-agent");
    } finally {
      warn.mockRestore();
    }
  });

  it("closes the view dropdown on a mousedown outside of it", () => {
    render(<ConversationsPrimaryView enabled={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Change view mode" }));
    expect(screen.getByRole("button", { name: /Summary/ })).toBeTruthy();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole("button", { name: /Summary/ })).toBeNull();
  });

  it("clears a restored draft and stash banner when switching sessions away and back", () => {
    const view = render(<ConversationsPrimaryView enabled={false} />);

    fireEvent.change(composer(), { target: { value: "remember me" } });
    fireEvent.keyDown(composer(), { key: "s", altKey: true });

    expect(screen.getByText(/Stashed:/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(composer()).toHaveValue("remember me");

    activateSession("s2", []);
    view.rerender(<ConversationsPrimaryView enabled={false} />);

    activateSession("s1", turns);
    view.rerender(<ConversationsPrimaryView enabled={false} />);

    expect(composer()).toHaveValue("");
    expect(screen.queryByText(/Stashed:/)).toBeNull();
  });
});
