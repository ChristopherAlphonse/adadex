import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { formatClock, formatDay, toTitle } from "../app/conversationText";
import { useConversationsRuntime } from "../app/hooks/useConversationsRuntime";
import { ClearAllConversationsDialog } from "./ClearAllConversationsDialog";
import { ConversationComposer } from "./ConversationComposer";
import { ConversationTurnBubble } from "./ConversationTurnBubble";
import { SidebarConversationsList } from "./SidebarConversationsList";

type ConversationsPrimaryViewProps = {
  enabled: boolean;
  onSidebarContent?: (content: ReactNode) => void;
  onActionPanel?: (content: ReactNode) => void;
};

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

  const [isPendingClearAll, setIsPendingClearAll] = useState(false);

  const onDeleteSession = useCallback(() => {
    if (selectedSessionId) {
      void deleteSession(selectedSessionId);
    }
  }, [selectedSessionId, deleteSession]);

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

  // Push sidebar content
  const sidebarContent = (
    <SidebarConversationsList
      sessions={sessions}
      selectedSessionId={selectedSessionId}
      isLoadingSessions={isLoadingConversationSessions}
      isSearching={isSearchingConversations}
      searchQuery={searchQuery}
      searchHits={conversationsSearchHits}
      onSelectSession={selectSession}
      onRefresh={() => {
        void refreshSessions();
      }}
      onClearAll={() => {
        setIsPendingClearAll(true);
      }}
      onSearch={(query) => {
        void searchConversations(query);
      }}
      onClearSearch={clearConversationsSearch}
      onNavigateToHit={navigateToConversationSearchHit}
    />
  );

  useEffect(() => {
    onSidebarContent?.(sidebarContent);

    return () => onSidebarContent?.(null);
  });

  // Push action panel for clear-all dialog
  const actionPanelContent = isPendingClearAll ? (
    <ClearAllConversationsDialog
      sessionCount={sessions.length}
      isClearing={isClearingConversations}
      onCancel={() => {
        setIsPendingClearAll(false);
      }}
      onConfirm={() => {
        void clearAllSessions().then(() => {
          setIsPendingClearAll(false);
        });
      }}
    />
  ) : null;

  useEffect(() => {
    onActionPanel?.(actionPanelContent);

    return () => onActionPanel?.(null);
  });

  const isDeletingSession = false;
  const highlightedRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    if (highlightedTurnId && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightedTurnId]);

  const [pendingMessages, setPendingMessages] = useState<{ id: string; text: string }[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const threadRef = useRef<HTMLOListElement | null>(null);

  const isLiveSession =
    selectedSession !== null &&
    !selectedSession.events.some((event) => event.type === "session_end");

  // A message stops being "pending" once the agent's transcript contains it.
  useEffect(() => {
    if (!selectedSession) {
      return;
    }

    setPendingMessages((current) =>
      current.filter(
        (message) =>
          !selectedSession.turns.some(
            (turn) => turn.role === "user" && turn.content.trim() === message.text.trim(),
          ),
      ),
    );
  }, [selectedSession]);

  // Each conversation starts with a clean composer state.
  useEffect(() => {
    setPendingMessages([]);
    setSendError(null);
  }, [selectedSessionId]);

  // While a message is waiting for the agent, keep checking for the reply.
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

  // Keep the newest message in view.
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

      setSendError(null);
      setPendingMessages((current) => [...current, { id, text }]);

      try {
        await sendMessage(selectedSessionId, text);
        void refreshSelectedSession();

        return true;
      } catch (error) {
        setPendingMessages((current) => current.filter((message) => message.id !== id));
        setSendError(error instanceof Error ? error.message : "Unable to send the message.");

        return false;
      }
    },
    [selectedSessionId, sendMessage, refreshSelectedSession],
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
                  disabled={isDeletingSession}
                  onClick={onDeleteSession}
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
            <ol className="chat-thread" ref={threadRef}>
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
                  <div className="chat-meta">Sent · the agent will reply when it is free</div>
                </li>
              ))}
            </ol>
            <ConversationComposer
              disabled={!isLiveSession}
              disabledReason="This session has ended. Start the agent again to keep talking."
              error={sendError}
              onSend={onSendMessage}
              key={selectedSession.sessionId}
            />
          </>
        ) : (
          <p className="conversations-empty">Select a conversation from the sidebar.</p>
        )}
      </section>
    </section>
  );
};
