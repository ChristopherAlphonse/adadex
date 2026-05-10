import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { GITHUB_SPARKLINE_HEIGHT, GITHUB_SPARKLINE_WIDTH, } from "../app/constants";
const MINI_USAGE_WIDTH = 160;
const MINI_USAGE_HEIGHT = 28;
const MINI_BAR_GAP = 1;
const buildUsageBars = (data) => {
    const days = Array.isArray(data.days) ? data.days.slice(-30) : [];
    if (days.length === 0)
        return [];
    const totals = days.map((day) => typeof day.totalTokens === "number" ? day.totalTokens : 0);
    const max = Math.max(...totals, 1);
    const barSlot = MINI_USAGE_WIDTH / days.length;
    const barWidth = Math.max(1, barSlot - MINI_BAR_GAP);
    return days.map((day, index) => {
        const totalTokens = typeof day.totalTokens === "number" ? day.totalTokens : 0;
        const h = Math.max(0.5, (totalTokens / max) * (MINI_USAGE_HEIGHT - 2));
        return {
            x: index * barSlot,
            y: MINI_USAGE_HEIGHT - h,
            width: barWidth,
            height: h,
        };
    });
};
const pct = (value, loading) => {
    if (loading)
        return "···";
    return value == null ? "NA" : `${Math.round(value)}%`;
};
const usageState = (codexUsage) => {
    if (codexUsage === null) {
        return {
            label: "Session",
            loading: true,
            sessionPercent: 0,
            weekPercent: 0,
        };
    }
    const label = codexUsage.source === "oauth-api" ? "5h" : "Session";
    if (codexUsage.status === "ok") {
        return {
            label,
            loading: false,
            sessionPercent: codexUsage.primaryUsedPercent,
            weekPercent: codexUsage.secondaryUsedPercent,
        };
    }
    return {
        label,
        loading: false,
        sessionPercent: null,
        weekPercent: null,
        message: codexUsage.message ?? "Codex usage unavailable",
    };
};
const UsageRail = ({ label, percent, loading, title, }) => {
    const [tooltip, setTooltip] = useState(null);
    const showTooltip = (clientX, clientY) => {
        if (!title)
            return;
        setTooltip({ x: clientX, y: clientY });
    };
    return (_jsxs("div", { className: "console-status-usage-row", "data-has-tooltip": title ? "true" : undefined, tabIndex: title ? 0 : -1, onMouseEnter: (event) => showTooltip(event.clientX, event.clientY), onMouseMove: (event) => showTooltip(event.clientX, event.clientY), onMouseLeave: () => setTooltip(null), onBlur: () => setTooltip(null), onFocus: (event) => {
            if (!title)
                return;
            const rect = event.currentTarget.getBoundingClientRect();
            setTooltip({ x: rect.left + 24, y: rect.bottom + 8 });
        }, children: [_jsxs("span", { className: "console-status-usage-row-meta", children: [_jsx("span", { className: "console-status-usage-row-label", children: label }), _jsx("span", { className: "console-status-usage-row-value", children: pct(percent, loading) })] }), _jsx("span", { className: "console-status-usage-rail", children: _jsx("span", { className: "console-status-usage-rail-fill", style: { width: `${Math.min(100, percent ?? 0)}%` } }) }), title && tooltip ? (_jsx("span", { className: "console-status-usage-tooltip", style: {
                    left: `${Math.max(8, tooltip.x - 260)}px`,
                    top: `${Math.min(window.innerHeight - 80, tooltip.y + 14)}px`,
                }, children: title })) : null] }));
};
export const RuntimeStatusStrip = ({ sparklinePoints, usageData, codexUsage, isRefreshingCodexUsage = false, onRefreshCodexUsage, }) => {
    const usageBars = useMemo(() => (usageData ? buildUsageBars(usageData) : []), [usageData]);
    const codexUsageState = usageState(codexUsage);
    const [showRefreshSpin, setShowRefreshSpin] = useState(false);
    const refreshStartedAtRef = useRef(null);
    const refreshHideTimerRef = useRef(null);
    useEffect(() => {
        return () => {
            if (refreshHideTimerRef.current !== null) {
                window.clearTimeout(refreshHideTimerRef.current);
            }
        };
    }, []);
    useEffect(() => {
        if (isRefreshingCodexUsage) {
            if (refreshHideTimerRef.current !== null) {
                window.clearTimeout(refreshHideTimerRef.current);
                refreshHideTimerRef.current = null;
            }
            refreshStartedAtRef.current = Date.now();
            setShowRefreshSpin(true);
            return;
        }
        if (refreshStartedAtRef.current === null) {
            setShowRefreshSpin(false);
            return;
        }
        const elapsedMs = Date.now() - refreshStartedAtRef.current;
        const remainingMs = Math.max(0, 450 - elapsedMs);
        refreshHideTimerRef.current = window.setTimeout(() => {
            setShowRefreshSpin(false);
            refreshStartedAtRef.current = null;
            refreshHideTimerRef.current = null;
        }, remainingMs);
    }, [isRefreshingCodexUsage]);
    return (_jsxs("section", { className: "console-status-strip", "aria-label": "Runtime status strip", children: [_jsx("div", { className: "console-status-main", children: _jsx("span", { className: "console-status-brand", children: "ADADEX" }) }), _jsxs("div", { className: "console-status-charts", children: [_jsxs("div", { className: "console-status-sparkline", "aria-label": "Commits per day over last 30 days", children: [_jsx("div", { className: "console-status-sparkline-chart", children: _jsx("svg", { viewBox: `0 0 ${GITHUB_SPARKLINE_WIDTH} ${GITHUB_SPARKLINE_HEIGHT}`, role: "presentation", children: _jsx("polyline", { points: sparklinePoints }) }) }), _jsx("span", { className: "console-status-sparkline-label", children: "COMMITS/DAY \u00B7 LAST 30 DAYS" })] }), _jsx("div", { className: "console-status-usage-mini", "aria-label": "Agent token usage last 30 days", children: usageBars.length > 0 ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "console-status-usage-mini-chart", children: _jsx("svg", { viewBox: `0 0 ${MINI_USAGE_WIDTH} ${MINI_USAGE_HEIGHT}`, role: "presentation", children: usageBars.map((bar, index) => (_jsx("rect", { x: bar.x, y: bar.y, width: bar.width, height: bar.height, rx: 0.5 }, `${index}-${bar.x}-${bar.height}`))) }) }), _jsx("span", { className: "console-status-sparkline-label", children: "AGENT TOKENS/DAY \u00B7 LAST 30 DAYS" })] })) : (_jsx("span", { className: "console-status-sparkline-label", children: "USAGE \u2014" })) })] }), _jsxs("div", { className: "console-status-codex-usage", "aria-label": "Codex usage limits", children: [onRefreshCodexUsage && (_jsx("button", { type: "button", className: "console-status-codex-usage-refresh", onClick: onRefreshCodexUsage, "aria-label": "Refresh Codex usage", title: "Refresh Codex usage", "data-refreshing": showRefreshSpin ? "true" : "false", children: "\u21BB" })), _jsxs("span", { className: "console-status-codex-usage-title", children: ["CODEX", _jsx("br", {}), "USAGE"] }), _jsxs("div", { className: "console-status-codex-usage-bars", children: [_jsx(UsageRail, { label: codexUsageState.label, percent: codexUsageState.sessionPercent, loading: codexUsageState.loading, ...(codexUsageState.message
                                    ? { title: codexUsageState.message }
                                    : {}) }), _jsx(UsageRail, { label: "Week (all)", percent: codexUsageState.weekPercent, loading: codexUsageState.loading, ...(codexUsageState.message
                                    ? { title: codexUsageState.message }
                                    : {}) })] })] })] }));
};
