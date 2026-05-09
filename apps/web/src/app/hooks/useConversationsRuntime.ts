import { useCallback, useEffect, useRef, useState } from "react";

import {
  buildConversationExportUrl,
  buildConversationSearchUrl,
  buildConversationSessionUrl,
  buildConversationsUrl,
} from "../../runtime/runtimeEndpoints";
import {
  normalizeConversationSessionDetail,
  normalizeConversationSessionSummary,
} from "../conversationNormalizers";
import type {
  ConversationSearchHit,
  ConversationSessionDetail,
  ConversationSessionSummary,
} from "../types";

type ConversationExportFormat = "json" | "md";

type ConversationExportResult = {
  filename: string;
  contentType: string;
  content: string;
};

type UseConversationsRuntimeOptions = {
  enabled?: boolean;
};

type UseConversationsRuntimeResult = {
  sessions: ConversationSessionSummary[];
  selectedSessionId: string | null;
  selectedSession: ConversationSessionDetail | null;
  isLoadingSessions: boolean;
  isLoadingSelectedSession: boolean;
  isExporting: boolean;
  isClearing: boolean;
  isSearching: boolean;
  searchQuery: string;
  searchHits: ConversationSearchHit[];
  highlightedTurnId: string | null;
  errorMessage: string | null;
  selectSession: (sessionId: string) => void;
  refreshSessions: () => Promise<void>;
  clearAllSessions: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  exportSession: (
    sessionId: string,
    format: ConversationExportFormat,
  ) => Promise<ConversationExportResult | null>;
  searchConversations: (query: string) => Promise<void>;
  clearSearch: () => void;
  navigateToSearchHit: (hit: ConversationSearchHit) => void;
};

const buildErrorMessage = (fallback: string, error: unknown) =>
  error instanceof Error && error.message.length > 0 ? error.message : fallback;

const buildExportFilename = (sessionId: string, format: ConversationExportFormat) =>
  `${sessionId}.${format === "json" ? "json" : "md"}`;

export const useConversationsRuntime = ({
  enabled = true,
}: UseConversationsRuntimeOptions = {}): UseConversationsRuntimeResult => {
  const [sessions, setSessions] = useState<ConversationSessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<ConversationSessionDetail | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingSelectedSession, setIsLoadingSelectedSession] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchHits, setSearchHits] = useState<ConversationSearchHit[]>([]);
  const [highlightedTurnId, setHighlightedTurnId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selectedSessionRequestRef = useRef(0);

  const refreshSessions = useCallback(async () => {
    if (!enabled) {
      return;
    }

    setIsLoadingSessions(true);
    try {
      const response = await fetch(buildConversationsUrl(), {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Unable to read conversations (${response.status})`);
      }

      const payload = (await response.json()) as unknown;
      const normalized = Array.isArray(payload)
        ? payload
            .map((entry) => normalizeConversationSessionSummary(entry))
            .filter((entry): entry is ConversationSessionSummary => entry !== null)
        : [];
      setSessions(normalized);
      setSelectedSessionId((current) => {
        if (current && normalized.some((session) => session.sessionId === current)) {
          return current;
        }

        return normalized[0]?.sessionId ?? null;
      });
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(buildErrorMessage("Unable to load conversations.", error));
    } finally {
      setIsLoadingSessions(false);
    }
  }, [enabled]);

  const clearAllSessions = useCallback(async () => {
    if (!enabled) {
      return;
    }

    setIsClearing(true);
    try {
      const response = await fetch(buildConversationsUrl(), {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Unable to clear conversations (${response.status})`);
      }

      setSessions([]);
      setSelectedSessionId(null);
      setSelectedSession(null);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(buildErrorMessage("Unable to clear conversations.", error));
    } finally {
      setIsClearing(false);
    }
  }, [enabled]);

  const deleteSession = useCallback(
    async (sessionId: string) => {
      if (!enabled) {
        return;
      }

      try {
        const response = await fetch(buildConversationSessionUrl(sessionId), {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error(`Unable to delete conversation (${response.status})`);
        }

        setSessions((current) => {
          const remaining = current.filter((s) => s.sessionId !== sessionId);
          if (selectedSessionId === sessionId) {
            const getTimestamp = (s: ConversationSessionSummary) => {
              const raw = s.lastEventAt ?? s.endedAt ?? s.startedAt;
              return raw ? Date.parse(raw) || 0 : 0;
            };
            const sorted = [...remaining].sort((a, b) => getTimestamp(b) - getTimestamp(a));
            const nextId = sorted[0]?.sessionId ?? null;
            setSelectedSessionId(nextId);
            if (!nextId) {
              setSelectedSession(null);
            }
          }
          return remaining;
        });
        setErrorMessage(null);
      } catch (error) {
        setErrorMessage(buildErrorMessage("Unable to delete conversation.", error));
      }
    },
    [enabled, selectedSessionId],
  );

  const selectSession = useCallback((sessionId: string) => {
    setSelectedSessionId(sessionId);
  }, []);

  const exportSession = useCallback(
    async (
      sessionId: string,
      format: ConversationExportFormat,
    ): Promise<ConversationExportResult | null> => {
      if (!enabled) {
        return null;
      }

      setIsExporting(true);
      try {
        const response = await fetch(buildConversationExportUrl(sessionId, format), {
          method: "GET",
          headers: {
            Accept: format === "json" ? "application/json" : "text/markdown",
          },
        });

        if (!response.ok) {
          throw new Error(`Unable to export conversation (${response.status})`);
        }

        if (format === "json") {
          const payload = (await response.json()) as unknown;
          const normalized = normalizeConversationSessionDetail(payload);
          const json = `${JSON.stringify(normalized ?? payload, null, 2)}\n`;
          return {
            filename: buildExportFilename(sessionId, "json"),
            contentType: "application/json",
            content: json,
          };
        }

        const markdown = await response.text();
        return {
          filename: buildExportFilename(sessionId, "md"),
          contentType: "text/markdown",
          content: markdown,
        };
      } catch (error) {
        setErrorMessage(buildErrorMessage("Unable to export conversation.", error));
        return null;
      } finally {
        setIsExporting(false);
      }
    },
    [enabled],
  );

  const searchConversationsAction = useCallback(
    async (query: string) => {
      if (!enabled) {
        return;
      }

      const trimmed = query.trim();
      setSearchQuery(trimmed);

      if (trimmed.length === 0) {
        setSearchHits([]);
        setHighlightedTurnId(null);
        return;
      }

      setIsSearching(true);
      try {
        const response = await fetch(buildConversationSearchUrl(trimmed), {
          method: "GET",
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(`Search failed (${response.status})`);
        }

        const payload = (await response.json()) as { hits?: unknown[] };
        const hits = Array.isArray(payload.hits) ? (payload.hits as ConversationSearchHit[]) : [];
        setSearchHits(hits);
        setHighlightedTurnId(null);
      } catch (error) {
        setErrorMessage(buildErrorMessage("Unable to search conversations.", error));
      } finally {
        setIsSearching(false);
      }
    },
    [enabled],
  );

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setSearchHits([]);
    setHighlightedTurnId(null);
  }, []);

  const navigateToSearchHit = useCallback((hit: ConversationSearchHit) => {
    setSelectedSessionId(hit.sessionId);
    setHighlightedTurnId(hit.turnId);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setSessions([]);
      setSelectedSessionId(null);
      setSelectedSession(null);
      setIsLoadingSessions(false);
      setIsLoadingSelectedSession(false);
      setIsExporting(false);
      setIsClearing(false);
      setIsSearching(false);
      setSearchQuery("");
      setSearchHits([]);
      setHighlightedTurnId(null);
      setErrorMessage(null);
      return;
    }

    void refreshSessions();
  }, [enabled, refreshSessions]);

  useEffect(() => {
    if (!enabled || !selectedSessionId) {
      setSelectedSession(null);
      return;
    }

    const requestId = selectedSessionRequestRef.current + 1;
    selectedSessionRequestRef.current = requestId;
    setIsLoadingSelectedSession(true);

    const loadSelectedSession = async () => {
      try {
        const response = await fetch(buildConversationSessionUrl(selectedSessionId), {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Unable to read conversation (${response.status})`);
        }

        const payload = normalizeConversationSessionDetail(await response.json());
        if (!payload) {
          throw new Error("Conversation response is invalid.");
        }

        if (selectedSessionRequestRef.current === requestId) {
          setSelectedSession(payload);
          setErrorMessage(null);
        }
      } catch (error) {
        if (selectedSessionRequestRef.current === requestId) {
          setSelectedSession(null);
          setErrorMessage(buildErrorMessage("Unable to read conversation.", error));
        }
      } finally {
        if (selectedSessionRequestRef.current === requestId) {
          setIsLoadingSelectedSession(false);
        }
      }
    };

    void loadSelectedSession();
  }, [enabled, selectedSessionId]);

  return {
    sessions,
    selectedSessionId,
    selectedSession,
    isLoadingSessions,
    isLoadingSelectedSession,
    isExporting,
    isClearing,
    isSearching,
    searchQuery,
    searchHits,
    highlightedTurnId,
    errorMessage,
    selectSession,
    refreshSessions,
    clearAllSessions,
    deleteSession,
    exportSession,
    searchConversations: searchConversationsAction,
    clearSearch,
    navigateToSearchHit,
  };
};
