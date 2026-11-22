import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { formatRelativeTime, toGist, toTitle } from "../app/conversationText";
import type { ConversationSearchHit, ConversationSessionSummary } from "../app/types";

const AVATAR_HUES = [210, 262, 152, 28, 340, 186];

const getSessionTitle = (session: ConversationSessionSummary): string =>
  toTitle(session.firstUserTurnPreview, session.sessionId, 40);

const getAvatarHue = (sessionId: string): number => {
  let hash = 0;

  for (const char of sessionId) {
    hash = (hash * 31 + char.charCodeAt(0)) % 997;
  }

  return AVATAR_HUES[hash % AVATAR_HUES.length] ?? 210;
};

const getSessionSortTimestamp = (session: ConversationSessionSummary): number => {
  const raw = session.lastEventAt ?? session.endedAt ?? session.startedAt;

  if (!raw) return 0;
  const parsed = Date.parse(raw);

  return Number.isFinite(parsed) ? parsed : 0;
};

type SidebarConversationsListProps = {
  sessions: ConversationSessionSummary[];
  selectedSessionId: string | null;
  isLoadingSessions: boolean;
  isSearching: boolean;
  searchQuery: string;
  searchHits: ConversationSearchHit[];
  onSelectSession: (sessionId: string) => void;
  onRefresh: () => void;
  onClearAll: () => void;
  onDeleteSession: (sessionId: string) => void;
  onSearch: (query: string) => void;
  onClearSearch: () => void;
  onNavigateToHit: (hit: ConversationSearchHit) => void;
  searchInputRef?: React.Ref<HTMLInputElement> | undefined;
};

export const SidebarConversationsList = ({
  sessions,
  selectedSessionId,
  isLoadingSessions,
  isSearching,
  searchQuery,
  searchHits,
  onSelectSession,
  onRefresh,
  onClearAll,
  onDeleteSession,
  onSearch,
  onClearSearch,
  onNavigateToHit,
  searchInputRef,
}: SidebarConversationsListProps) => {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Merge external searchInputRef with internal inputRef
  const setInputRef = useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;

      if (searchInputRef && "current" in searchInputRef) {
        searchInputRef.current = node;

        return;
      }

      searchInputRef?.(node);
    },
    [searchInputRef],
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSearchRef = useRef(onSearch);
  const onClearSearchRef = useRef(onClearSearch);

  useEffect(() => {
    onSearchRef.current = onSearch;
    onClearSearchRef.current = onClearSearch;
  }, [onSearch, onClearSearch]);

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => getSessionSortTimestamp(b) - getSessionSortTimestamp(a)),
    [sessions],
  );

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const trimmed = inputValue.trim();

    if (trimmed.length === 0) {
      onClearSearchRef.current();

      return;
    }

    if (trimmed.length >= 2) {
      debounceRef.current = setTimeout(() => {
        onSearchRef.current(trimmed);
      }, 280);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [inputValue]);

  const handleSearchSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = inputValue.trim();

      if (trimmed.length > 0) {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }

        onSearch(trimmed);
      }
    },
    [inputValue, onSearch],
  );

  const handleClearSearch = useCallback(() => {
    setInputValue("");
    onClearSearch();
    inputRef.current?.focus();
  }, [onClearSearch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClearSearch();
      }
    },
    [handleClearSearch],
  );

  const isShowingResults = searchQuery.length > 0;

  return (
    <section className="active-agents-section" aria-label="Sidebar section Conversations">
      <div className="sidebar-conversations-toolbar">
        <button
          aria-label="Refresh conversations"
          className="sidebar-conversations-icon-btn"
          disabled={isLoadingSessions}
          onClick={onRefresh}
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
            <path d="M2.5 8a5.5 5.5 0 0 1 9.3-3.95L13.5 5.5" />
            <path d="M13.5 2.5v3h-3" />
            <path d="M13.5 8a5.5 5.5 0 0 1-9.3 3.95L2.5 10.5" />
            <path d="M2.5 13.5v-3h3" />
          </svg>
        </button>
        <button
          aria-label="Clear all conversations"
          className="sidebar-conversations-icon-btn sidebar-conversations-icon-btn--danger"
          disabled={sessions.length === 0}
          onClick={onClearAll}
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

      <form className="sidebar-conversations-search" onSubmit={handleSearchSubmit}>
        <div className="sidebar-conversations-search-input-wrap">
          <svg
            aria-hidden="true"
            className="sidebar-conversations-search-icon"
            focusable="false"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" />
          </svg>
          <input
            ref={setInputRef}
            type="text"
            className="sidebar-conversations-search-input"
            placeholder="Search conversations..."
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            aria-label="Search conversations"
          />
          {(inputValue.length > 0 || isShowingResults) && (
            <button
              type="button"
              className="sidebar-conversations-search-clear"
              onClick={handleClearSearch}
              aria-label="Clear search"
            >
              <svg
                aria-hidden="true"
                focusable="false"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 4l8 8" />
                <path d="M12 4l-8 8" />
              </svg>
            </button>
          )}
        </div>
      </form>

      <div className="active-agents-section-panel">
        {isSearching ? (
          <p className="active-agents-status">Searching...</p>
        ) : isShowingResults ? (
          searchHits.length === 0 ? (
            <p className="active-agents-status">No results for "{searchQuery}"</p>
          ) : (
            <div className="sidebar-search-results">
              <p className="sidebar-search-results-count">
                {searchHits.length} result{searchHits.length !== 1 ? "s" : ""}
              </p>
              <ol className="sidebar-conversations-list">
                {searchHits.map((hit) => (
                  <li key={`${hit.sessionId}-${hit.turnId}`}>
                    <button
                      className="sidebar-conversation-item sidebar-search-hit"
                      onClick={() => {
                        onNavigateToHit(hit);
                      }}
                      type="button"
                    >
                      <span className="sidebar-search-hit-session">{hit.sessionId}</span>
                      <span className="sidebar-search-hit-role">{hit.role}</span>
                      <span className="sidebar-search-hit-snippet">{toGist(hit.snippet, 120)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )
        ) : sessions.length === 0 ? (
          <p className="active-agents-status">No conversations yet.</p>
        ) : (
          <ol className="sidebar-conversations-list">
            {sortedSessions.map((session) => (
              <li className="sidebar-conversation-row" key={session.sessionId}>
                <button
                  aria-current={session.sessionId === selectedSessionId ? "page" : undefined}
                  className="sidebar-conversation-item"
                  data-active={session.sessionId === selectedSessionId ? "true" : "false"}
                  onClick={() => {
                    onSelectSession(session.sessionId);
                  }}
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className="sidebar-conversation-avatar"
                    style={
                      /* SAFETY: React passes custom properties through; "--avatar-hue" is a valid CSS variable name. */
                      { "--avatar-hue": getAvatarHue(session.sessionId) } as React.CSSProperties
                    }
                  >
                    {getSessionTitle(session).charAt(0).toUpperCase()}
                  </span>
                  <span className="sidebar-conversation-body">
                    <span className="sidebar-conversation-top">
                      <strong>{getSessionTitle(session)}</strong>
                      <time>{formatRelativeTime(session.lastEventAt ?? session.endedAt)}</time>
                    </span>
                    <span className="sidebar-conversation-preview">
                      {toGist(
                        session.lastAssistantTurnPreview ??
                          session.lastUserTurnPreview ??
                          `${session.turnCount} messages`,
                        90,
                      )}
                    </span>
                  </span>
                </button>
                <button
                  aria-label={`Delete conversation ${getSessionTitle(session)}`}
                  className="sidebar-conversation-delete"
                  onClick={() => {
                    onDeleteSession(session.sessionId);
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
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
};
