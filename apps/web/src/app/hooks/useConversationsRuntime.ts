import { asRecord, asString, type ParsedValue } from "@adadex/core";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  buildChannelMessagesUrl,
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
  isDeleting: boolean;
  isSearching: boolean;
  searchQuery: string;
  searchHits: ConversationSearchHit[];
  highlightedTurnId: string | null;
  errorMessage: string | null;
  selectSession: (sessionId: string) => void;
  refreshSelectedSession: () => Promise<void>;
  sendMessage: (sessionId: string, content: string) => Promise<void>;
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

const buildErrorMessage = (fallback: string, cause: unknown) =>
  cause instanceof Error && cause.message.length > 0 ? cause.message : fallback;

const normalizeConversationSearchHit = (value: ParsedValue): ConversationSearchHit | null => {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  const sessionId = asString(record.sessionId);
  const turnId = asString(record.turnId);
  const role = record.role;
  const snippet = asString(record.snippet);
  const turnStartedAt = asString(record.turnStartedAt);

  if (
    !sessionId ||
    !turnId ||
    (role !== "user" && role !== "assistant") ||
    snippet === null ||
    !turnStartedAt
  ) {
    return null;
  }

  return { sessionId, turnId, role, snippet, turnStartedAt };
};

const buildExportFilename = (sessionId: string, format: ConversationExportFormat) =>
  `${sessionId}.${format === "json" ? "json" : "md"}`;

type ConversationSessionsResult =
  | { ok: true; sessions: ConversationSessionSummary[] }
  | { ok: false; errorMessage: string };

const requestConversationSessions = async (): Promise<ConversationSessionsResult> => {
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

    const payload: ParsedValue = await response.json();

    const sessions = Array.isArray(payload)
      ? payload
          .map((entry) => normalizeConversationSessionSummary(entry))
          .filter((entry): entry is ConversationSessionSummary => entry !== null)
      : [];

    return { ok: true, sessions };
  } catch (error) {
    return {
      ok: false,
      errorMessage: buildErrorMessage("Unable to load conversations.", error),
    };
  }
};

export const useConversationsRuntime = ({
  enabled = true,
}: UseConversationsRuntimeOptions = {}): UseConversationsRuntimeResult => {
  const [sessions, setSessions] = useState<ConversationSessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<ConversationSessionDetail | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(enabled);
  const [isLoadingSelectedSession, setIsLoadingSelectedSession] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchHits, setSearchHits] = useState<ConversationSearchHit[]>([]);
  const [highlightedTurnId, setHighlightedTurnId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selectedSessionRequestRef = useRef(0);

  const loadSessions = useCallback(
    () =>
      requestConversationSessions().then((result) => {
        setIsLoadingSessions(false);

        if (!result.ok) {
          setErrorMessage(result.errorMessage);

          return;
        }

        const { sessions: normalized } = result;
        setSessions(normalized);
        setSelectedSessionId((current) => {
          if (current && normalized.some((session) => session.sessionId === current)) {
            return current;
          }

          return normalized[0]?.sessionId ?? null;
        });
        setErrorMessage(null);
      }),
    [],
  );

  const refreshSessions = useCallback(async () => {
    if (!enabled) {
      return;
    }

    setIsLoadingSessions(true);
    await loadSessions();
  }, [enabled, loadSessions]);

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

      setIsDeleting(true);

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
      } finally {
        setIsDeleting(false);
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
          const payload: ParsedValue = await response.json();
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

        const payload = asRecord(await response.json());
        const rawHits = payload?.hits;

        const hits = Array.isArray(rawHits)
          ? rawHits
              .map((hit) => normalizeConversationSearchHit(hit))
              .filter((hit): hit is ConversationSearchHit => hit !== null)
          : [];

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

  // Reset and loading flags follow `enabled` and the selected session. They are adjusted
  // during render when those inputs change (React's "adjust state when a prop changes"
  // pattern) so the effects below only talk to the API.
  const [previousEnabled, setPreviousEnabled] = useState(enabled);

  if (previousEnabled !== enabled) {
    setPreviousEnabled(enabled);

    setIsLoadingSessions(enabled);

    if (!enabled) {
      setSessions([]);
      setSelectedSessionId(null);
      setIsExporting(false);
      setIsClearing(false);
      setIsDeleting(false);
      setIsSearching(false);
      setSearchQuery("");
      setSearchHits([]);
      setHighlightedTurnId(null);
      setErrorMessage(null);
    }
  }

  const activeSessionId = enabled ? selectedSessionId : null;
  const [previousActiveSessionId, setPreviousActiveSessionId] = useState(activeSessionId);

  if (previousActiveSessionId !== activeSessionId) {
    setPreviousActiveSessionId(activeSessionId);
    setIsLoadingSelectedSession(activeSessionId !== null);

    if (activeSessionId === null) {
      setSelectedSession(null);
    }
  }

  useEffect(() => {
    if (enabled) {
      void loadSessions();
    }
  }, [enabled, loadSessions]);

  useEffect(() => {
    if (!activeSessionId) return;

    const requestId = selectedSessionRequestRef.current + 1;
    selectedSessionRequestRef.current = requestId;

    const loadSelectedSession = async () => {
      try {
        const response = await fetch(buildConversationSessionUrl(activeSessionId), {
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
  }, [activeSessionId]);

  const refreshSelectedSession = useCallback(async () => {
    if (!activeSessionId) return;

    try {
      const response = await fetch(buildConversationSessionUrl(activeSessionId), {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) return;

      const payload = normalizeConversationSessionDetail(await response.json());

      if (payload && payload.sessionId === activeSessionId) {
        setSelectedSession(payload);
      }
    } catch {
      // A failed background refresh keeps what is already on screen.
    }
  }, [activeSessionId]);

  const sendMessage = useCallback(async (sessionId: string, content: string) => {
    const response = await fetch(buildChannelMessagesUrl(sessionId), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ fromTerminalId: "operator", content }),
    });

    if (!response.ok) {
      const failure = asRecord(await response.json().catch(() => null));
      const reason = asString(failure?.error);

      throw new Error(reason ?? `Unable to send message (${response.status})`);
    }
  }, []);

  return {
    sessions,
    selectedSessionId,
    selectedSession,
    isLoadingSessions,
    isLoadingSelectedSession,
    isExporting,
    isClearing,
    isDeleting,
    isSearching,
    searchQuery,
    searchHits,
    highlightedTurnId,
    errorMessage,
    selectSession,
    refreshSelectedSession,
    sendMessage,
    refreshSessions,
    clearAllSessions,
    deleteSession,
    exportSession,
    searchConversations: searchConversationsAction,
    clearSearch,
    navigateToSearchHit,
  };
};
