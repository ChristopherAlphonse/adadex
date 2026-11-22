import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { readAgentProviderPreference } from "../app/agentProviders";
import { formatClock, formatDay, toTitle } from "../app/conversationText";
import { useConversationChat } from "../app/hooks/useConversationChat";
import { useConversationsRuntime } from "../app/hooks/useConversationsRuntime";
import { isEditableEventTarget } from "../app/hotkeys";
import { ClearAllConversationsDialog } from "./ClearAllConversationsDialog";
import { ConversationChatThread } from "./ConversationChatThread";
import { ConversationComposer } from "./ConversationComposer";
import { ConversationTurnBubble } from "./ConversationTurnBubble";
import { DeleteConversationDialog } from "./DeleteConversationDialog";
import { SidebarConversationsList } from "./SidebarConversationsList";
import { TerminalChatPane } from "./TerminalChatPane";

type ConversationsPrimaryViewProps = {
  enabled: boolean;
  onSidebarContent?: (content: ReactNode) => void;
  onActionPanel?: (content: ReactNode) => void;
};

type ComposerState = {
  sessionId: string | null;
  pendingMessages: { id: string; text: string }[];
  sendError: string | null;
};

const emptyComposerStateFor = (sessionId: string | null): ComposerState => ({
  sessionId,
  pendingMessages: [],
  sendError: null,
});

export const ConversationsPrimaryView = ({
  enabled,
  onSidebarContent,
  onActionPanel,
}: ConversationsPrimaryViewProps) => {
  const {
    sessions,
    selectedSessionId,
    selectedSession,
    isLoadingSessions: isLoadingConversationSessions,
    isLoadingSelectedSession,
    isExporting,
    isClearing: isClearingConversations,
    isDeleting: isDeletingConversation,
    isSearching: isSearchingConversations,
    searchQuery,
    searchHits: conversationsSearchHits,
    highlightedTurnId,
    errorMessage,
    selectSession,
    refreshSelectedSession,
    sendMessage,
    refreshSessions,
    clearAllSessions,
    deleteSession,
    exportSession,
    searchConversations,
    clearSearch: clearConversationsSearch,
    navigateToSearchHit: navigateToConversationSearchHit,
  } = useConversationsRuntime({ enabled });

  const [isPlainView, setIsPlainView] = useState(false);

  const [chatTerminalMode, setChatTerminalMode] = useState<"chat" | "terminal">("chat");
  const [agentProvider] = useState(readAgentProviderPreference);

  const chatMessages = useConversationChat(
    selectedSessionId,
    selectedSession ? `${selectedSession.lastEventAt}:${selectedSession.turnCount}` : null,
  );

  const showRichChat =
    !isPlainView &&
    chatMessages !== null &&
    highlightedTurnId === null &&
    chatMessages.some((message) => message.blocks.some((block) => block.kind === "tool-call"));

  const [isPendingClearAll, setIsPendingClearAll] = useState(false);
  const [pendingDeleteSessionId, setPendingDeleteSessionId] = useState<string | null>(null);

  const onRequestDeleteSession = useCallback((sessionId: string) => {
    setPendingDeleteSessionId(sessionId);
  }, []);

  const pendingDeleteSession = pendingDeleteSessionId
    ? sessions.find((session) => session.sessionId === pendingDeleteSessionId)
    : undefined;

  const pendingDeleteTitle = pendingDeleteSession
    ? toTitle(pendingDeleteSession.firstUserTurnPreview, pendingDeleteSession.sessionId, 64)
    : (pendingDeleteSessionId ?? "this conversation");

  const onExport = useCallback(
    (format: "json" | "md") => {
      if (!selectedSessionId) {
        return;
      }

      void exportSession(selectedSessionId, format).then((result) => {
        if (!result) {
          return;
        }

        const blob = new Blob([result.content], { type: result.contentType });
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = result.filename;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
      });
    },
    [selectedSessionId, exportSession],
  );

  const handleRefreshSessions = useCallback(() => {
    void refreshSessions();
  }, [refreshSessions]);

  const handleRequestClearAll = useCallback(() => {
    setIsPendingClearAll(true);
  }, []);

  const handleSearchConversations = useCallback(
    (query: string) => {
      void searchConversations(query);
    },
    [searchConversations],
  );

  const sidebarContent = useMemo(
    () => (
      <SidebarConversationsList
        sessions={sessions}
        selectedSessionId={selectedSessionId}
        isLoadingSessions={isLoadingConversationSessions}
        isSearching={isSearchingConversations}
        searchQuery={searchQuery}
        searchHits={conversationsSearchHits}
        onSelectSession={selectSession}
        onRefresh={handleRefreshSessions}
        onClearAll={handleRequestClearAll}
        onDeleteSession={onRequestDeleteSession}
        onSearch={handleSearchConversations}
        onClearSearch={clearConversationsSearch}
        onNavigateToHit={navigateToConversationSearchHit}
      />
    ),
    [
      sessions,
      selectedSessionId,
      isLoadingConversationSessions,
      isSearchingConversations,
      searchQuery,
      conversationsSearchHits,
      selectSession,
      handleRefreshSessions,
      handleRequestClearAll,
      onRequestDeleteSession,
      handleSearchConversations,
      clearConversationsSearch,
      navigateToConversationSearchHit,
    ],
  );

  useEffect(() => {
    onSidebarContent?.(sidebarContent);

    return () => onSidebarContent?.(null);
  }, [onSidebarContent, sidebarContent]);

  const handleCancelDelete = useCallback(() => {
    setPendingDeleteSessionId(null);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (!pendingDeleteSessionId) return;
    void deleteSession(pendingDeleteSessionId).then(() => {
      setPendingDeleteSessionId(null);
    });
  }, [deleteSession, pendingDeleteSessionId]);

  const handleCancelClearAll = useCallback(() => {
    setIsPendingClearAll(false);
  }, []);

  const handleConfirmClearAll = useCallback(() => {
    void clearAllSessions().then(() => {
      setIsPendingClearAll(false);
    });
  }, [clearAllSessions]);

  const actionPanelContent = useMemo(
    () =>
      pendingDeleteSessionId ? (
        <DeleteConversationDialog
          title={pendingDeleteTitle}
          isDeleting={isDeletingConversation}
          onCancel={handleCancelDelete}
          onConfirm={handleConfirmDelete}
        />
      ) : isPendingClearAll ? (
        <ClearAllConversationsDialog
          sessionCount={sessions.length}
          isClearing={isClearingConversations}
          onCancel={handleCancelClearAll}
          onConfirm={handleConfirmClearAll}
        />
      ) : null,
    [
      pendingDeleteSessionId,
      pendingDeleteTitle,
      isDeletingConversation,
      handleCancelDelete,
      handleConfirmDelete,
      isPendingClearAll,
      sessions.length,
      isClearingConversations,
      handleCancelClearAll,
      handleConfirmClearAll,
    ],
  );

  useEffect(() => {
    onActionPanel?.(actionPanelContent);

    return () => onActionPanel?.(null);
  }, [onActionPanel, actionPanelContent]);

  const highlightedRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    if (highlightedTurnId && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightedTurnId]);

  const [storedComposerState, setComposerState] = useState<ComposerState>(() =>
    emptyComposerStateFor(selectedSessionId),
  );

  const [stashedDraft, setStashedDraft] = useState<string | null>(null);
  const [restoreDraft, setRestoreDraft] = useState<string | null>(null);

  const threadRef = useRef<HTMLOListElement | null>(null);

  const composerState =
    storedComposerState.sessionId === selectedSessionId
      ? storedComposerState
      : emptyComposerStateFor(selectedSessionId);

  const updateComposerState = useCallback(
    (update: (current: ComposerState) => ComposerState) => {
      setComposerState((current) =>
        update(
          current.sessionId === selectedSessionId
            ? current
            : emptyComposerStateFor(selectedSessionId),
        ),
      );
    },
    [selectedSessionId],
  );

  const isLiveSession =
    selectedSession !== null &&
    !selectedSession.events.some((event) => event.type === "session_end");

  // Alt+G / Option+G: toggle between chat and terminal view
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || (event.key !== "g" && event.key !== "G")) {
        return;
      }

      if (selectedSession === null) {
        return;
      }

      if (isEditableEventTarget(event.target)) {
        return;
      }

      event.preventDefault();
      setChatTerminalMode((current) => (current === "chat" ? "terminal" : "chat"));
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedSession]);

  const isAcknowledged = (text: string) =>
    selectedSession?.turns.some(
      (turn) => turn.role === "user" && turn.content.trim() === text.trim(),
    ) ?? false;

  const pendingMessages = composerState.pendingMessages.filter(
    (message) => !isAcknowledged(message.text),
  );

  const hasPendingMessages = pendingMessages.length > 0;

  useEffect(() => {
    if (!hasPendingMessages) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshSelectedSession();
    }, 3000);

    return () => {
      window.clearInterval(interval);
    };
  }, [hasPendingMessages, refreshSelectedSession]);

  const turnCount = selectedSession?.turns.length ?? 0;

  useEffect(() => {
    if (highlightedTurnId || !threadRef.current) {
      return;
    }

    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [selectedSessionId, turnCount, pendingMessages.length, highlightedTurnId]);

  const onSendMessage = useCallback(
    async (text: string): Promise<boolean> => {
      if (!selectedSessionId) {
        return false;
      }

      const id = `pending-${Date.now()}`;

      updateComposerState((current) => ({
        ...current,
        sendError: null,
        pendingMessages: [...current.pendingMessages, { id, text }],
      }));

      try {
        await sendMessage(selectedSessionId, text);
        void refreshSelectedSession();

        return true;
      } catch (error) {
        updateComposerState((current) => ({
          ...current,
          sendError: error instanceof Error ? error.message : "Unable to send the message.",
          pendingMessages: current.pendingMessages.filter((message) => message.id !== id),
        }));

        return false;
      }
    },
    [selectedSessionId, sendMessage, refreshSelectedSession, updateComposerState],
  );

  const handleStash = useCallback((text: string) => {
    setStashedDraft(text);
  }, []);

  const handleQueue = useCallback(
    (text: string) => {
      updateComposerState((current) => ({
        ...current,
        pendingMessages: [...current.pendingMessages, { id: `pending-${Date.now()}`, text }],
      }));
    },
    [updateComposerState],
  );

  const handleStop = useCallback(() => {
    console.warn("Agent stop not yet implemented");
  }, []);

  const handleInterruptAndSend = useCallback(
    async (text: string): Promise<boolean> => {
      return onSendMessage(text);
    },
    [onSendMessage],
  );

  const sendNow = useCallback(
    async (message: { id: string; text: string }) => {
      // Optimistically remove from pending
      updateComposerState((current) => ({
        ...current,
        pendingMessages: current.pendingMessages.filter((m) => m.id !== message.id),
      }));

      if (!selectedSessionId) {
        return;
      }

      try {
        await sendMessage(selectedSessionId, message.text);
        void refreshSelectedSession();
      } catch (error) {
        // Re-add to pending on failure
        updateComposerState((current) => ({
          ...current,
          sendError: error instanceof Error ? error.message : "Unable to send the message.",
          pendingMessages: [...current.pendingMessages, message],
        }));
      }
    },
    [selectedSessionId, sendMessage, refreshSelectedSession, updateComposerState],
  );

  return (
    <section className="conversations-view" aria-label="Conversations primary view">
      {errorMessage ? <p className="conversations-error">{errorMessage}</p> : null}

      <section className="conversations-transcript" aria-label="Conversation transcript pane">
        {isLoadingSelectedSession ? (
          <p className="conversations-empty">Loading conversation...</p>
        ) : selectedSession ? (
          <>
            <header className="chat-header">
              <div className="chat-header-copy">
                <h3>
                  {toTitle(selectedSession.firstUserTurnPreview, selectedSession.sessionId, 64)}
                </h3>
                <p>
                  {[
                    formatDay(selectedSession.startedAt),
                    `${formatClock(selectedSession.startedAt)} – ${formatClock(selectedSession.endedAt)}`,
                    `${selectedSession.turns.length} messages`,
                  ]
                    .filter((part) => part.trim().length > 1)
                    .join(" · ")}
                </p>
              </div>
              <div className="chat-header-actions">
                {chatMessages ? (
                  <button
                    aria-label="Toggle between rich chat and plain turns"
                    aria-pressed={isPlainView}
                    className="chat-ghost-btn"
                    onClick={() => {
                      setIsPlainView((value) => !value);
                    }}
                    type="button"
                  >
                    {isPlainView ? "Rich" : "Plain"}
                  </button>
                ) : null}
                <button
                  aria-label={
                    chatTerminalMode === "chat" ? "Switch to terminal view" : "Switch to chat view"
                  }
                  className="chat-ghost-btn"
                  onClick={() => {
                    setChatTerminalMode((current) => (current === "chat" ? "terminal" : "chat"));
                  }}
                  type="button"
                >
                  {chatTerminalMode === "chat" ? "Terminal" : "Chat"}
                </button>
                <button
                  aria-label="Export conversation as JSON"
                  className="chat-ghost-btn"
                  disabled={isExporting}
                  onClick={() => {
                    onExport("json");
                  }}
                  type="button"
                >
                  JSON
                </button>
                <button
                  aria-label="Export conversation as Markdown"
                  className="chat-ghost-btn"
                  disabled={isExporting}
                  onClick={() => {
                    onExport("md");
                  }}
                  type="button"
                >
                  Markdown
                </button>
                <button
                  aria-label="Delete this conversation"
                  className="chat-ghost-btn chat-ghost-btn--icon chat-ghost-btn--danger"
                  disabled={isDeletingConversation || !selectedSessionId}
                  onClick={() => {
                    if (selectedSessionId) {
                      onRequestDeleteSession(selectedSessionId);
                    }
                  }}
                  type="button"
                >
                  <svg
                    aria-hidden="true"
                    focusable="false"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 4h10" />
                    <path d="M6 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1" />
                    <path d="M4.5 4l.5 9a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-9" />
                    <path d="M6.5 7v4" />
                    <path d="M9.5 7v4" />
                  </svg>
                </button>
              </div>
            </header>
            {chatTerminalMode === "terminal" ? (
              <div className="chat-terminal-embed">
                <TerminalChatPane terminalId={selectedSession.sessionId} />
              </div>
            ) : (
              <>
                {showRichChat && chatMessages ? (
                  <ConversationChatThread
                    messages={chatMessages}
                    onSendAnswer={
                      selectedSessionId ? (text) => sendMessage(selectedSessionId, text) : undefined
                    }
                  />
                ) : null}
                <ol className="chat-thread" hidden={showRichChat} ref={threadRef}>
                  {selectedSession.turns.map((turn, index) => {
                    const isHighlighted = turn.turnId === highlightedTurnId;

                    return (
                      <ConversationTurnBubble
                        content={turn.content}
                        highlightTerm={
                          isHighlighted && searchQuery.length > 0 ? searchQuery : undefined
                        }
                        highlighted={isHighlighted}
                        key={turn.turnId}
                        ref={isHighlighted ? highlightedRef : undefined}
                        role={turn.role}
                        showSender={selectedSession.turns[index - 1]?.role !== turn.role}
                        startedAt={turn.startedAt}
                      />
                    );
                  })}
                  {pendingMessages.map((message) => (
                    <li className="chat-turn" data-pending="true" data-role="user" key={message.id}>
                      <div className="chat-bubble">
                        <p className="chat-bubble-gist">{message.text}</p>
                      </div>
                      <div className="chat-meta">
                        Sent · the agent will reply when it is free
                        <button
                          aria-label="Send now"
                          className="chat-pending-play"
                          onClick={() => void sendNow(message)}
                          type="button"
                        >
                          <svg
                            aria-hidden="true"
                            fill="currentColor"
                            focusable="false"
                            viewBox="0 0 16 16"
                          >
                            <path d="M5 3.5l8 4.5-8 4.5V3.5z" />
                          </svg>
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
                {stashedDraft !== null ? (
                  <div className="chat-stash-banner">
                    <span className="chat-stash-banner-text">
                      Stashed: &ldquo;
                      {stashedDraft.length > 60 ? `${stashedDraft.slice(0, 60)}…` : stashedDraft}
                      &rdquo;
                    </span>
                    <button
                      className="chat-stash-banner-restore"
                      onClick={() => {
                        setRestoreDraft(stashedDraft);
                        setStashedDraft(null);
                      }}
                      type="button"
                    >
                      Restore
                    </button>
                    <button
                      aria-label="Dismiss stash"
                      className="chat-stash-banner-dismiss"
                      onClick={() => {
                        setStashedDraft(null);
                      }}
                      type="button"
                    >
                      <svg
                        aria-hidden="true"
                        fill="none"
                        focusable="false"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 16 16"
                      >
                        <path d="M4 4l8 8M12 4l-8 8" />
                      </svg>
                    </button>
                  </div>
                ) : null}
                <ConversationComposer
                  disabled={!isLiveSession}
                  disabledReason="This session has ended. Start the agent again to keep talking."
                  error={composerState.sendError}
                  {...(restoreDraft !== null ? { externalDraft: restoreDraft } : {})}
                  onInterruptAndSend={handleInterruptAndSend}
                  onQueue={handleQueue}
                  onSend={onSendMessage}
                  onStash={handleStash}
                  onStop={handleStop}
                  key={`${selectedSession.sessionId}:${restoreDraft ?? ""}`}
                />
                <div className="chat-model-row">
                  <button
                    aria-label="Switch model or effort"
                    className="chat-model-pill"
                    onClick={() => {
                      console.warn("Model switching not yet implemented");
                    }}
                    title="Option+P / Alt+P to switch model"
                    type="button"
                  >
                    {agentProvider} · default
                  </button>
                </div>
              </>
            )}
          </>
        ) : (
          <p className="conversations-empty">Select a conversation from the sidebar.</p>
        )}
      </section>
    </section>
  );
};
