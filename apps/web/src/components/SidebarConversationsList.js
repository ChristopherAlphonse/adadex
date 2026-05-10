import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
const getSessionTitle = (session) => {
    const preview = session.firstUserTurnPreview;
    if (!preview)
        return session.sessionId;
    const words = preview.split(/\s+/).slice(0, 8);
    const title = words.join(" ");
    return title.length < preview.length ? `${title}...` : title;
};
const getSessionSortTimestamp = (session) => {
    const raw = session.lastEventAt ?? session.endedAt ?? session.startedAt;
    if (!raw)
        return 0;
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : 0;
};
export const SidebarConversationsList = ({ sessions, selectedSessionId, isLoadingSessions, isSearching, searchQuery, searchHits, onSelectSession, onRefresh, onClearAll, onSearch, onClearSearch, onNavigateToHit, }) => {
    const [inputValue, setInputValue] = useState("");
    const inputRef = useRef(null);
    const debounceRef = useRef(null);
    const onSearchRef = useRef(onSearch);
    const onClearSearchRef = useRef(onClearSearch);
    onSearchRef.current = onSearch;
    onClearSearchRef.current = onClearSearch;
    const sortedSessions = useMemo(() => [...sessions].sort((a, b) => getSessionSortTimestamp(b) - getSessionSortTimestamp(a)), [sessions]);
    // Live search: debounce input changes and trigger search after 2+ chars
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
    const handleSearchSubmit = useCallback((e) => {
        e.preventDefault();
        const trimmed = inputValue.trim();
        if (trimmed.length > 0) {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
            onSearch(trimmed);
        }
    }, [inputValue, onSearch]);
    const handleClearSearch = useCallback(() => {
        setInputValue("");
        onClearSearch();
        inputRef.current?.focus();
    }, [onClearSearch]);
    const handleKeyDown = useCallback((e) => {
        if (e.key === "Escape") {
            handleClearSearch();
        }
    }, [handleClearSearch]);
    const isShowingResults = searchQuery.length > 0;
    return (_jsxs("section", { className: "active-agents-section", "aria-label": "Sidebar section Conversations", children: [_jsxs("div", { className: "sidebar-conversations-toolbar", children: [_jsx("button", { "aria-label": "Refresh conversations", className: "sidebar-conversations-icon-btn", disabled: isLoadingSessions, onClick: onRefresh, type: "button", children: _jsxs("svg", { "aria-hidden": "true", focusable: "false", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M2.5 8a5.5 5.5 0 0 1 9.3-3.95L13.5 5.5" }), _jsx("path", { d: "M13.5 2.5v3h-3" }), _jsx("path", { d: "M13.5 8a5.5 5.5 0 0 1-9.3 3.95L2.5 10.5" }), _jsx("path", { d: "M2.5 13.5v-3h3" })] }) }), _jsx("button", { "aria-label": "Clear all conversations", className: "sidebar-conversations-icon-btn sidebar-conversations-icon-btn--danger", disabled: sessions.length === 0, onClick: onClearAll, type: "button", children: _jsxs("svg", { "aria-hidden": "true", focusable: "false", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M3 4h10" }), _jsx("path", { d: "M6 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1" }), _jsx("path", { d: "M4.5 4l.5 9a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-9" }), _jsx("path", { d: "M6.5 7v4" }), _jsx("path", { d: "M9.5 7v4" })] }) })] }), _jsx("form", { className: "sidebar-conversations-search", onSubmit: handleSearchSubmit, children: _jsxs("div", { className: "sidebar-conversations-search-input-wrap", children: [_jsxs("svg", { "aria-hidden": "true", className: "sidebar-conversations-search-icon", focusable: "false", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("circle", { cx: "7", cy: "7", r: "4.5" }), _jsx("path", { d: "M10.5 10.5L14 14" })] }), _jsx("input", { ref: inputRef, type: "text", className: "sidebar-conversations-search-input", placeholder: "Search conversations...", value: inputValue, onChange: (e) => {
                                setInputValue(e.target.value);
                            }, onKeyDown: handleKeyDown, "aria-label": "Search conversations" }), (inputValue.length > 0 || isShowingResults) && (_jsx("button", { type: "button", className: "sidebar-conversations-search-clear", onClick: handleClearSearch, "aria-label": "Clear search", children: _jsxs("svg", { "aria-hidden": "true", focusable: "false", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M4 4l8 8" }), _jsx("path", { d: "M12 4l-8 8" })] }) }))] }) }), _jsx("div", { className: "active-agents-section-panel", children: isSearching ? (_jsx("p", { className: "active-agents-status", children: "Searching..." })) : isShowingResults ? (searchHits.length === 0 ? (_jsxs("p", { className: "active-agents-status", children: ["No results for \"", searchQuery, "\""] })) : (_jsxs("div", { className: "sidebar-search-results", children: [_jsxs("p", { className: "sidebar-search-results-count", children: [searchHits.length, " result", searchHits.length !== 1 ? "s" : ""] }), _jsx("ol", { className: "sidebar-conversations-list", children: searchHits.map((hit) => (_jsx("li", { children: _jsxs("button", { className: "sidebar-conversation-item sidebar-search-hit", onClick: () => {
                                        onNavigateToHit(hit);
                                    }, type: "button", children: [_jsx("span", { className: "sidebar-search-hit-session", children: hit.sessionId }), _jsx("span", { className: "sidebar-search-hit-role", children: hit.role }), _jsx("span", { className: "sidebar-search-hit-snippet", children: hit.snippet })] }) }, `${hit.sessionId}-${hit.turnId}`))) })] }))) : sessions.length === 0 ? (_jsx("p", { className: "active-agents-status", children: "No conversations yet." })) : (_jsx("ol", { className: "sidebar-conversations-list", children: sortedSessions.map((session) => (_jsx("li", { children: _jsxs("button", { "aria-current": session.sessionId === selectedSessionId ? "page" : undefined, className: "sidebar-conversation-item", "data-active": session.sessionId === selectedSessionId ? "true" : "false", onClick: () => {
                                onSelectSession(session.sessionId);
                            }, type: "button", children: [_jsx("strong", { children: getSessionTitle(session) }), _jsx("span", { children: `Orchestration ${session.coordinationId ?? "--"}` }), _jsx("span", { children: `${session.turnCount} turns` })] }) }, session.sessionId))) })) })] }));
};
