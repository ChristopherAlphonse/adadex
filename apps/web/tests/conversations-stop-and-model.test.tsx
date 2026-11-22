import type { ConversationSessionDetail, TranscriptMessage } from "@adadex/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConversationsPrimaryView } from "../src/components/ConversationsPrimaryView";

type RuntimeState = {
  sessions: ConversationSessionDetail[];
  selectedSessionId: string | null;
  selectedSession: ConversationSessionDetail | null;
  chatMessages: TranscriptMessage[] | null;
  refreshSelectedSession: ReturnType<typeof vi.fn>;
  refreshSessions: ReturnType<typeof vi.fn>;
  sendMessage: ReturnType<typeof vi.fn>;
};

const runtime: RuntimeState = vi.hoisted(() => ({
  sessions: [],
  selectedSessionId: null,
  selectedSession: null,
  chatMessages: null,
  refreshSelectedSession: vi.fn(async () => undefined),
  refreshSessions: vi.fn(async () => undefined),
  sendMessage: vi.fn(async () => undefined),
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
    refreshSelectedSession: runtime.refreshSelectedSession,
    sendMessage: runtime.sendMessage,
    refreshSessions: runtime.refreshSessions,
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

const session: ConversationSessionDetail = {
  sessionId: "s1",
  coordinationId: null,
  startedAt: "2026-11-22T10:00:00.000Z",
  endedAt: null,
  lastEventAt: "2026-11-22T10:01:05.000Z",
  eventCount: 4,
  turnCount: 2,
  userTurnCount: 1,
  assistantTurnCount: 1,
  firstUserTurnPreview: "Do the thing",
  lastUserTurnPreview: "Do the thing",
  lastAssistantTurnPreview: "Done",
  turns: [],
  events: [],
};

const memoryStorage = new Map<string, string>();

Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => memoryStorage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memoryStorage.set(key, value);
    },
    removeItem: (key: string) => {
      memoryStorage.delete(key);
    },
    clear: () => memoryStorage.clear(),
  },
});

let stopError: string | null = null;

const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
  const url = String(input);

  if (url.includes("/api/terminal-snapshots")) {
    return new Response(
      JSON.stringify([
        {
          terminalId: "s1",
          label: "s1",
          state: "live",
          coordinationId: "s1",
          createdAt: "2026-11-22T10:00:00.000Z",
          agentModel: "claude-sonnet-4-5",
          agentEffort: "medium",
        },
      ]),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  if (url.includes("/launch-options")) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (url.endsWith("/stop")) {
    if (stopError) {
      return new Response(JSON.stringify({ error: stopError }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(null, { status: 200 });
  }

  return new Response("not-found", { status: 404 });
});

beforeEach(() => {
  stopError = null;
  fetchMock.mockClear();
  runtime.chatMessages = null;
  runtime.sessions = [session];
  runtime.selectedSession = session;
  runtime.selectedSessionId = "s1";
  runtime.refreshSelectedSession.mockClear();
  runtime.refreshSessions.mockClear();
  runtime.sendMessage.mockClear();
  window.localStorage.setItem("adadex.agentProvider", "claude");
  memoryStorage.delete("adadex.agentLaunchOptions");
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("ConversationsPrimaryView stop and model controls", () => {
  it("stops the agent when Escape is pressed twice and refreshes the session", async () => {
    render(<ConversationsPrimaryView enabled />);

    const textbox = screen.getByRole("textbox", { name: "Message the agent" });

    fireEvent.keyDown(textbox, { key: "Escape" });
    fireEvent.keyDown(textbox, { key: "Escape" });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/terminals/s1/stop",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(runtime.refreshSelectedSession).toHaveBeenCalledOnce();
    expect(runtime.refreshSessions).toHaveBeenCalledOnce();
  });

  it("surfaces a stop failure in the composer", async () => {
    stopError = "Agent is busy.";

    render(<ConversationsPrimaryView enabled />);

    const textbox = screen.getByRole("textbox", { name: "Message the agent" });

    fireEvent.keyDown(textbox, { key: "Escape" });
    fireEvent.keyDown(textbox, { key: "Escape" });

    expect(await screen.findByText("Agent is busy.")).toBeTruthy();
  });

  it("shows the terminal's saved launch options and saves edits through the API", async () => {
    render(<ConversationsPrimaryView enabled />);

    const pill = screen.getByRole("button", { name: "Switch model or effort" });

    await waitFor(() => expect(pill.textContent).toContain("claude-sonnet-4-5"));

    fireEvent.click(pill);

    expect(screen.getByRole("dialog", { name: "Agent launch options" })).toBeTruthy();

    fireEvent.change(screen.getByRole("textbox", { name: "Model (optional)" }), {
      target: { value: "claude-opus-5-5" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Effort" }), {
      target: { value: "high" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/terminals/s1/launch-options",
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    const patchCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/launch-options"));

    expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({
      agentModel: "claude-opus-5-5",
      agentEffort: "high",
    });
    expect(window.localStorage.getItem("adadex.agentLaunchOptions")).toBe(
      JSON.stringify({ model: "claude-opus-5-5", effort: "high" }),
    );
    await waitFor(() => expect(pill.textContent).toContain("claude-opus-5-5"));
    expect(screen.queryByRole("dialog", { name: "Agent launch options" })).toBeNull();
  });

  it("opens the launch options with Alt+P", () => {
    render(<ConversationsPrimaryView enabled />);

    fireEvent.keyDown(window, { key: "p", altKey: true });

    expect(screen.getByRole("dialog", { name: "Agent launch options" })).toBeTruthy();
  });
});
