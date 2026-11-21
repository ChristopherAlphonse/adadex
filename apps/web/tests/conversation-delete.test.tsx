import type { ConversationSessionSummary } from "@adadex/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DeleteConversationDialog } from "../src/components/DeleteConversationDialog";
import { SidebarConversationsList } from "../src/components/SidebarConversationsList";

const makeSession = (
  sessionId: string,
  firstUserTurnPreview: string,
): ConversationSessionSummary => ({
  sessionId,
  coordinationId: null,
  startedAt: "2026-11-20T10:00:00.000Z",
  endedAt: "2026-11-20T10:05:00.000Z",
  lastEventAt: "2026-11-20T10:05:00.000Z",
  eventCount: 4,
  turnCount: 2,
  userTurnCount: 1,
  assistantTurnCount: 1,
  firstUserTurnPreview,
  lastUserTurnPreview: firstUserTurnPreview,
  lastAssistantTurnPreview: "Done",
});

const renderSidebar = (onDeleteSession: (sessionId: string) => void, onSelectSession = vi.fn()) =>
  render(
    <SidebarConversationsList
      sessions={[makeSession("session-a", "Fix login bug"), makeSession("session-b", "Add search")]}
      selectedSessionId="session-a"
      isLoadingSessions={false}
      isSearching={false}
      searchQuery=""
      searchHits={[]}
      onSelectSession={onSelectSession}
      onRefresh={vi.fn()}
      onClearAll={vi.fn()}
      onDeleteSession={onDeleteSession}
      onSearch={vi.fn()}
      onClearSearch={vi.fn()}
      onNavigateToHit={vi.fn()}
    />,
  );

describe("per-conversation delete", () => {
  afterEach(() => {
    cleanup();
  });

  it("offers a delete control on each conversation row", () => {
    const onDeleteSession = vi.fn();

    renderSidebar(onDeleteSession);

    expect(
      screen.getByRole("button", { name: "Delete conversation Fix login bug" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete conversation Add search" }),
    ).toBeInTheDocument();
  });

  it("deletes only the clicked conversation", () => {
    const onDeleteSession = vi.fn();
    const onSelectSession = vi.fn();

    renderSidebar(onDeleteSession, onSelectSession);

    fireEvent.click(screen.getByRole("button", { name: "Delete conversation Add search" }));

    expect(onDeleteSession).toHaveBeenCalledExactlyOnceWith("session-b");
    expect(onSelectSession).not.toHaveBeenCalled();
  });

  it("asks for confirmation before deleting one conversation", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <DeleteConversationDialog
        title="Fix login bug"
        isDeleting={false}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText("Fix login bug")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirm delete conversation" }));
    expect(onConfirm).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Cancel delete" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
