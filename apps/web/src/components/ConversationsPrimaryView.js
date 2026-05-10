import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatTimestamp } from "../app/formatTimestamp";
import { useConversationsRuntime } from "../app/hooks/useConversationsRuntime";
import { ClearAllConversationsDialog } from "./ClearAllConversationsDialog";
import { SidebarConversationsList } from "./SidebarConversationsList";
import { ActionButton } from "./ui/ActionButton";
import { MarkdownContent } from "./ui/MarkdownContent";
export const ConversationsPrimaryView = ({ enabled, onSidebarContent, onActionPanel, }) => {
    const { sessions, selectedSessionId, selectedSession, isLoadingSessions: isLoadingConversationSessions, isLoadingSelectedSession, isExporting, isClearing: isClearingConversations, isSearching: isSearchingConversations, searchQuery, searchHits: conversationsSearchHits, highlightedTurnId, errorMessage, selectSession, refreshSessions, clearAllSessions, deleteSession, exportSession, searchConversations, clearSearch: clearConversationsSearch, navigateToSearchHit: navigateToConversationSearchHit, } = useConversationsRuntime({ enabled });
    const [isPendingClearAll, setIsPendingClearAll] = useState(false);
    const onDeleteSession = useCallback(() => {
        if (selectedSessionId) {
            void deleteSession(selectedSessionId);
        }
    }, [selectedSessionId, deleteSession]);
    const onExport = useCallback((format) => {
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
    }, [selectedSessionId, exportSession]);
    // Push sidebar content
    const sidebarContent = (_jsx(SidebarConversationsList, { sessions: sessions, selectedSessionId: selectedSessionId, isLoadingSessions: isLoadingConversationSessions, isSearching: isSearchingConversations, searchQuery: searchQuery, searchHits: conversationsSearchHits, onSelectSession: selectSession, onRefresh: () => {
            void refreshSessions();
        }, onClearAll: () => {
            setIsPendingClearAll(true);
        }, onSearch: (query) => {
            void searchConversations(query);
        }, onClearSearch: clearConversationsSearch, onNavigateToHit: navigateToConversationSearchHit }));
    useEffect(() => {
        onSidebarContent?.(sidebarContent);
        return () => onSidebarContent?.(null);
    });
    // Push action panel for clear-all dialog
    const actionPanelContent = isPendingClearAll ? (_jsx(ClearAllConversationsDialog, { sessionCount: sessions.length, isClearing: isClearingConversations, onCancel: () => {
            setIsPendingClearAll(false);
        }, onConfirm: () => {
            void clearAllSessions().then(() => {
                setIsPendingClearAll(false);
            });
        } })) : null;
    useEffect(() => {
        onActionPanel?.(actionPanelContent);
        return () => onActionPanel?.(null);
    });
    const isDeletingSession = false;
    const highlightedRef = useRef(null);
    useEffect(() => {
        if (highlightedTurnId && highlightedRef.current) {
            highlightedRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }, [highlightedTurnId]);
    return (_jsxs("section", { className: "conversations-view", "aria-label": "Conversations primary view", children: [errorMessage ? _jsx("p", { className: "conversations-error", children: errorMessage }) : null, _jsx("section", { className: "conversations-transcript", "aria-label": "Conversation transcript pane", children: isLoadingSelectedSession ? (_jsx("p", { className: "conversations-empty", children: "Loading conversation..." })) : selectedSession ? (_jsxs(_Fragment, { children: [_jsxs("header", { className: "conversations-transcript-header", children: [_jsxs("div", { className: "conversations-transcript-header-top", children: [_jsx("h3", { children: selectedSession.sessionId }), _jsxs("div", { className: "conversations-transcript-header-actions", children: [_jsx(ActionButton, { "aria-label": "Export conversation as JSON", className: "conversations-export", disabled: isExporting, onClick: () => {
                                                        onExport("json");
                                                    }, size: "dense", variant: "info", children: isExporting ? "Exporting..." : "Export JSON" }), _jsx(ActionButton, { "aria-label": "Export conversation as Markdown", className: "conversations-export", disabled: isExporting, onClick: () => {
                                                        onExport("md");
                                                    }, size: "dense", variant: "info", children: isExporting ? "Exporting..." : "Export Markdown" }), _jsx("button", { "aria-label": "Delete this conversation", className: "conversations-delete-btn", disabled: isDeletingSession, onClick: onDeleteSession, type: "button", children: _jsxs("svg", { "aria-hidden": "true", focusable: "false", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M3 4h10" }), _jsx("path", { d: "M6 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1" }), _jsx("path", { d: "M4.5 4l.5 9a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-9" }), _jsx("path", { d: "M6.5 7v4" }), _jsx("path", { d: "M9.5 7v4" })] }) })] })] }), _jsxs("dl", { children: [_jsxs("div", { children: [_jsx("dt", { children: "Started" }), _jsx("dd", { children: formatTimestamp(selectedSession.startedAt) })] }), _jsxs("div", { children: [_jsx("dt", { children: "Ended" }), _jsx("dd", { children: formatTimestamp(selectedSession.endedAt) })] }), _jsxs("div", { children: [_jsx("dt", { children: "Events" }), _jsx("dd", { children: selectedSession.eventCount })] })] })] }), _jsx("ol", { className: "conversations-turn-list", children: selectedSession.turns.map((turn) => (_jsxs("li", { className: "conversations-turn", "data-role": turn.role, "data-highlighted": turn.turnId === highlightedTurnId ? "true" : undefined, ref: turn.turnId === highlightedTurnId ? highlightedRef : undefined, children: [_jsx("time", { className: "conversations-turn-time", dateTime: turn.startedAt, children: formatTimestamp(turn.startedAt) }), _jsx(MarkdownContent, { content: turn.content, className: "conversations-turn-content", ...(turn.turnId === highlightedTurnId && searchQuery.length > 0
                                            ? { highlightTerm: searchQuery }
                                            : {}) })] }, turn.turnId))) })] })) : (_jsx("p", { className: "conversations-empty", children: "Select a conversation from the sidebar." })) })] }));
};
