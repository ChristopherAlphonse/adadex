import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionButton } from "./ui/ActionButton";
const SEGMENT_COLORS = [
    "var(--accent-primary, #a3e635)",
    "var(--accent-secondary, #eab308)",
    "#ffffff",
    "#d9f99d",
    "#84cc16",
    "color-mix(in srgb, var(--accent-secondary, #eab308) 72%, #ffffff 28%)",
    "#f5f5f5",
    "color-mix(in srgb, var(--accent-primary, #a3e635) 72%, #ffffff 28%)",
    "color-mix(in srgb, var(--accent-secondary, #eab308) 84%, #000000 16%)",
    "color-mix(in srgb, var(--accent-primary, #a3e635) 84%, #000000 16%)",
    "color-mix(in srgb, var(--accent-secondary, #eab308) 48%, #ffffff 52%)",
    "color-mix(in srgb, var(--accent-primary, #a3e635) 48%, #ffffff 52%)",
];
const formatTokenCount = (tokens) => {
    if (tokens >= 1_000_000)
        return `${(tokens / 1_000_000).toFixed(1)}M`;
    if (tokens >= 1_000)
        return `${(tokens / 1_000).toFixed(1)}K`;
    return tokens.toString();
};
const formatDateLabel = (date) => {
    const d = new Date(`${date}T00:00:00`);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const buildColorMap = (keys) => new Map(keys.map((k, i) => [
    k,
    SEGMENT_COLORS[i % SEGMENT_COLORS.length] ?? SEGMENT_COLORS[0] ?? "#ffffff",
]));
const buildBars = (days, keys, mode) => {
    const colorMap = buildColorMap(keys);
    return days.map((day) => {
        const slices = mode === "model" ? day.models : day.projects;
        return {
            date: day.date,
            totalTokens: day.totalTokens,
            sessions: day.sessions,
            segments: slices.map((s) => ({
                label: s.key,
                tokens: s.tokens,
                color: colorMap.get(s.key) ?? "#555",
            })),
        };
    });
};
const buildYTicks = (maxTokens) => {
    if (maxTokens === 0)
        return [];
    const ticks = [];
    const step = maxTokens / 4;
    for (let i = 0; i <= 4; i++) {
        const value = step * i;
        ticks.push({ value, label: formatTokenCount(Math.round(value)) });
    }
    return ticks;
};
/* ── Tooltip (shared) ───────────────────────────────── */
const ChartTooltip = ({ bar, x, y, containerWidth, }) => {
    const isRightHalf = x > containerWidth / 2;
    return (_jsxs("div", { className: "usage-heatmap-tooltip", "aria-live": "polite", style: isRightHalf
            ? { right: `${containerWidth - x + 12}px`, top: `${y + 12}px` }
            : { left: `${x + 12}px`, top: `${y + 12}px` }, children: [_jsx("p", { className: "usage-heatmap-tooltip-date", children: formatDateLabel(bar.date) }), _jsxs("dl", { className: "usage-heatmap-tooltip-stats", children: [_jsxs("div", { children: [_jsx("dt", { children: "Total" }), _jsx("dd", { children: formatTokenCount(bar.totalTokens) })] }), bar.segments.map((seg) => (_jsxs("div", { children: [_jsxs("dt", { children: [_jsx("span", { className: "usage-chart-legend-dot", style: { backgroundColor: seg.color } }), seg.label] }), _jsx("dd", { children: formatTokenCount(seg.tokens) })] }, seg.label))), _jsxs("div", { children: [_jsx("dt", { children: "Sessions" }), _jsx("dd", { children: bar.sessions })] })] })] }));
};
/* ── Trend curve ───────────────────────────────────── */
const buildTrendPath = (bars, maxTokens, chartHeight, yAxisWidth, topPad, barSlotWidth) => {
    if (bars.length < 2 || maxTokens === 0)
        return "";
    const LIFT = 8;
    const points = bars.map((bar, i) => ({
        x: yAxisWidth + i * barSlotWidth + barSlotWidth / 2,
        y: Math.max(topPad, topPad + chartHeight - (bar.totalTokens / maxTokens) * chartHeight - LIFT),
    }));
    if (points.length === 2) {
        const [firstPoint, secondPoint] = points;
        if (!firstPoint || !secondPoint)
            return "";
        return `M${firstPoint.x},${firstPoint.y}L${secondPoint.x},${secondPoint.y}`;
    }
    const [firstPoint] = points;
    if (!firstPoint)
        return "";
    let d = `M${firstPoint.x},${firstPoint.y}`;
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];
        if (!p0 || !p1 || !p2 || !p3)
            continue;
        const cp1x = p1.x + (p2.x - p0.x) / 10;
        const cp1y = Math.max(topPad, p1.y + (p2.y - p0.y) / 10);
        const cp2x = p2.x - (p3.x - p1.x) / 10;
        const cp2y = Math.max(topPad, p2.y - (p3.y - p1.y) / 10);
        d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
};
/* ── Bar chart view ─────────────────────────────────── */
const Y_AXIS_WIDTH = 52;
const X_LABEL_HEIGHT = 18;
const TOP_PAD = 6;
const BAR_GAP_RATIO = 0.3;
const BarChartView = ({ bars, maxTokens, containerWidth, containerHeight, setHoveredBar, }) => {
    const chartAreaWidth = containerWidth - Y_AXIS_WIDTH;
    const barCount = bars.length || 1;
    const barSlotWidth = chartAreaWidth / barCount;
    const barWidth = barSlotWidth * (1 - BAR_GAP_RATIO);
    const barGap = barSlotWidth * BAR_GAP_RATIO;
    const chartHeight = Math.max(60, containerHeight - X_LABEL_HEIGHT - TOP_PAD);
    const svgHeight = TOP_PAD + chartHeight + X_LABEL_HEIGHT;
    const yTicks = useMemo(() => buildYTicks(maxTokens), [maxTokens]);
    const xLabelStep = Math.max(1, Math.ceil(barCount / Math.floor(chartAreaWidth / 60)));
    const trendPath = useMemo(() => buildTrendPath(bars, maxTokens, chartHeight, Y_AXIS_WIDTH, TOP_PAD, barSlotWidth), [bars, maxTokens, chartHeight, barSlotWidth]);
    return (_jsxs("svg", { className: "usage-chart-svg", viewBox: `0 0 ${containerWidth} ${svgHeight}`, role: "img", "aria-label": "Token usage bar chart", children: [yTicks.map((tick) => {
                const y = TOP_PAD + chartHeight - (maxTokens > 0 ? (tick.value / maxTokens) * chartHeight : 0);
                return (_jsxs("g", { children: [_jsx("line", { x1: Y_AXIS_WIDTH, y1: y, x2: containerWidth, y2: y, className: "usage-chart-grid-line" }), _jsx("text", { x: Y_AXIS_WIDTH - 6, y: y + 3.5, className: "usage-chart-y-label", children: tick.label })] }, tick.value));
            }), bars.map((bar, i) => {
                const x = Y_AXIS_WIDTH + i * barSlotWidth + barGap / 2;
                let yOffset = TOP_PAD + chartHeight;
                return (_jsxs("g", { onMouseEnter: () => setHoveredBar(bar), onMouseLeave: () => setHoveredBar(null), className: "usage-chart-bar-group", children: [_jsx("rect", { x: x, y: TOP_PAD, width: barWidth, height: chartHeight, fill: "transparent", className: "usage-chart-bar-hit" }), bar.segments.map((seg) => {
                            const segHeight = maxTokens > 0 ? (seg.tokens / maxTokens) * chartHeight : 0;
                            yOffset -= segHeight;
                            return (_jsx("rect", { x: x, y: yOffset, width: barWidth, height: Math.max(0.5, segHeight), fill: seg.color, rx: 1 }, seg.label));
                        })] }, bar.date));
            }), bars.map((bar, i) => {
                if (i % xLabelStep !== 0)
                    return null;
                const x = Y_AXIS_WIDTH + i * barSlotWidth + barSlotWidth / 2;
                return (_jsx("text", { x: x, y: TOP_PAD + chartHeight + X_LABEL_HEIGHT - 2, className: "usage-chart-x-label", children: formatDateLabel(bar.date) }, `label-${bar.date}`));
            }), trendPath && (_jsx("path", { d: trendPath, className: "usage-chart-trend-line", fill: "none", stroke: "rgba(215, 166, 34, 0.55)", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }))] }));
};
/* ── Heatmap view ───────────────────────────────────── */
const CELL_GAP = 3;
const CELL_RADIUS = 2;
const WEEKS_TO_SHOW = 26;
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
const MONTH_LABELS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];
const INTENSITY_COLORS = ["transparent", "#3d2008", "#6b3a0e", "#b5611a", "#d7a622"];
const buildHeatmapGrid = (bars) => {
    const barMap = new Map(bars.map((b) => [b.date, b]));
    const tokenValues = bars.map((b) => b.totalTokens).filter((v) => v > 0);
    tokenValues.sort((a, b) => a - b);
    const getIntensity = (tokens) => {
        if (tokens === 0 || tokenValues.length === 0)
            return 0;
        const idx = tokenValues.findIndex((v) => v >= tokens);
        const pos = idx === -1 ? tokenValues.length : idx;
        const ratio = pos / tokenValues.length;
        if (ratio <= 0.25)
            return 1;
        if (ratio <= 0.5)
            return 2;
        if (ratio <= 0.75)
            return 3;
        return 4;
    };
    const today = new Date();
    const todayDow = today.getUTCDay();
    const endDate = new Date(today);
    endDate.setUTCDate(today.getUTCDate() + (6 - todayDow));
    const startDate = new Date(endDate);
    startDate.setUTCDate(endDate.getUTCDate() - WEEKS_TO_SHOW * 7 + 1);
    const cells = [];
    const cursor = new Date(startDate);
    let week = 0;
    while (cursor <= endDate) {
        const dateStr = cursor.toISOString().slice(0, 10);
        const dayOfWeek = cursor.getUTCDay();
        const bar = barMap.get(dateStr) ?? null;
        cells.push({
            date: dateStr,
            week,
            dayOfWeek,
            totalTokens: bar?.totalTokens ?? 0,
            sessions: bar?.sessions ?? 0,
            intensity: getIntensity(bar?.totalTokens ?? 0),
            bar,
        });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        if (cursor.getUTCDay() === 0)
            week++;
    }
    return cells;
};
const buildMonthLabels = (cells) => {
    const labels = [];
    let lastMonth = -1;
    for (const cell of cells) {
        if (cell.dayOfWeek !== 0)
            continue;
        const month = new Date(cell.date).getUTCMonth();
        if (month !== lastMonth) {
            const label = MONTH_LABELS[month];
            if (!label)
                continue;
            labels.push({ label, week: cell.week });
            lastMonth = month;
        }
    }
    return labels;
};
const HeatmapView = ({ bars, containerWidth, containerHeight, setHoveredBar, }) => {
    const cells = useMemo(() => buildHeatmapGrid(bars), [bars]);
    const monthLabels = useMemo(() => buildMonthLabels(cells), [cells]);
    const dayLabelWidth = 32;
    const monthLabelHeight = 16;
    const availableHeight = containerHeight - monthLabelHeight - 8;
    const availableWidth = containerWidth - dayLabelWidth - 8;
    const cellSize = Math.max(8, Math.min(Math.floor((availableHeight - 6 * CELL_GAP) / 7), Math.floor((availableWidth - (WEEKS_TO_SHOW - 1) * CELL_GAP) / WEEKS_TO_SHOW)));
    const gridWidth = WEEKS_TO_SHOW * (cellSize + CELL_GAP);
    const gridHeight = 7 * (cellSize + CELL_GAP);
    const svgWidth = dayLabelWidth + gridWidth + 8;
    const svgHeight = monthLabelHeight + gridHeight + 8;
    return (_jsxs("svg", { className: "usage-chart-svg usage-chart-svg--heatmap", viewBox: `0 0 ${svgWidth} ${svgHeight}`, width: svgWidth, height: svgHeight, role: "img", "aria-label": "Token usage heatmap", children: [monthLabels.map(({ label, week }) => (_jsx("text", { x: dayLabelWidth + week * (cellSize + CELL_GAP), y: monthLabelHeight - 4, className: "usage-heatmap-month-label", children: label }, `month-${week}`))), DAY_LABELS.map((label, dayIndex) => label ? (_jsx("text", { x: dayLabelWidth - 6, y: monthLabelHeight + dayIndex * (cellSize + CELL_GAP) + cellSize - 2, className: "usage-heatmap-day-label", children: label }, label)) : null), cells.map((cell) => (_jsx("rect", { x: dayLabelWidth + cell.week * (cellSize + CELL_GAP), y: monthLabelHeight + cell.dayOfWeek * (cellSize + CELL_GAP), width: cellSize, height: cellSize, rx: CELL_RADIUS, fill: INTENSITY_COLORS[cell.intensity] ?? INTENSITY_COLORS[0] ?? "transparent", className: "usage-heatmap-cell", onMouseEnter: () => {
                    if (cell.bar)
                        setHoveredBar(cell.bar);
                }, onMouseLeave: () => setHoveredBar(null) }, cell.date)))] }));
};
/* ── Measured panel wrapper ──────────────────────────── */
const usePanelSize = () => {
    const [width, setWidth] = useState(400);
    const [height, setHeight] = useState(200);
    const ref = useRef(null);
    const measure = useCallback(() => {
        if (ref.current) {
            setWidth(ref.current.clientWidth);
            setHeight(ref.current.clientHeight);
        }
    }, []);
    useEffect(() => {
        measure();
        const observer = new ResizeObserver(measure);
        if (ref.current)
            observer.observe(ref.current);
        return () => observer.disconnect();
    }, [measure]);
    return { ref, width, height };
};
/* ── Main component ─────────────────────────────────── */
export const UsageBarChart = ({ data, isLoading, onRefresh }) => {
    const [segmentMode, setSegmentMode] = useState("project");
    const [hoveredBar, setHoveredBar] = useState(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const splitRef = useRef(null);
    const barPanel = usePanelSize();
    const heatmapPanel = usePanelSize();
    const days = data?.days ?? [];
    const projects = data?.projects ?? [];
    const models = data?.models ?? [];
    const segmentKeys = segmentMode === "model" ? models : projects;
    const maxTokens = useMemo(() => {
        let max = 0;
        for (const d of days) {
            if (d.totalTokens > max)
                max = d.totalTokens;
        }
        return max;
    }, [days]);
    const totalTokens = useMemo(() => days.reduce((s, d) => s + d.totalTokens, 0), [days]);
    const totalSessions = useMemo(() => days.reduce((s, d) => s + d.sessions, 0), [days]);
    const activeDays = useMemo(() => days.filter((d) => d.totalTokens > 0).length, [days]);
    const bars = useMemo(() => buildBars(days, segmentKeys, segmentMode), [days, segmentKeys, segmentMode]);
    const heatmapBars = useMemo(() => buildBars(days, projects, "project"), [days, projects]);
    const colorMap = useMemo(() => buildColorMap(segmentKeys), [segmentKeys]);
    const stats = useMemo(() => {
        const [firstDay] = days;
        if (!firstDay)
            return null;
        const peakDay = days.reduce((best, d) => (d.totalTokens > best.totalTokens ? d : best), firstDay);
        const avgPerSession = totalSessions > 0 ? Math.round(totalTokens / totalSessions) : 0;
        const topModel = models[0] ?? "—";
        const topProject = projects[0] ?? "—";
        let streak = 0;
        let maxStreak = 0;
        for (let i = days.length - 1; i >= 0; i--) {
            const day = days[i];
            if (!day)
                continue;
            if (day.totalTokens > 0) {
                streak++;
                if (streak > maxStreak)
                    maxStreak = streak;
            }
            else {
                streak = 0;
            }
        }
        return { peakDay, avgPerSession, topModel, topProject, maxStreak };
    }, [days, totalTokens, totalSessions, models, projects]);
    return (_jsxs("section", { className: "usage-heatmap", "aria-label": "Agent token usage chart", children: [_jsxs("header", { className: "usage-heatmap-header", children: [_jsxs("div", { className: "usage-heatmap-header-left", children: [_jsx("h3", { children: "Agent Token Usage" }), _jsxs("span", { className: "usage-heatmap-summary", children: [formatTokenCount(totalTokens), " tokens across ", activeDays, " days, ", totalSessions, " ", "sessions"] })] }), _jsx("div", { className: "usage-heatmap-header-actions", children: _jsx(ActionButton, { "aria-label": "Refresh usage chart data", className: "usage-heatmap-refresh", disabled: isLoading, onClick: onRefresh, size: "dense", variant: "accent", children: isLoading ? "Scanning..." : "Refresh" }) })] }), _jsxs("div", { className: "usage-chart-split", ref: splitRef, onMouseMove: (e) => {
                    const rect = splitRef.current?.getBoundingClientRect();
                    if (rect) {
                        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                    }
                }, children: [_jsxs("div", { className: "usage-chart-bar-segment-toggle", children: [_jsx("button", { type: "button", className: `usage-chart-bar-segment-btn${segmentMode === "project" ? " is-active" : ""}`, onClick: () => setSegmentMode("project"), children: "Project" }), _jsx("button", { type: "button", className: `usage-chart-bar-segment-btn${segmentMode === "model" ? " is-active" : ""}`, onClick: () => setSegmentMode("model"), children: "Model" })] }), _jsxs("div", { className: "usage-chart-left-stack", children: [_jsx("div", { className: "usage-chart-panel", ref: barPanel.ref, children: _jsx(BarChartView, { bars: bars, maxTokens: maxTokens, containerWidth: barPanel.width, containerHeight: barPanel.height, hoveredBar: hoveredBar, setHoveredBar: setHoveredBar }) }), segmentKeys.length > 1 && (_jsx("div", { className: "usage-chart-legend", children: segmentKeys.map((key) => (_jsxs("span", { className: "usage-chart-legend-item", children: [_jsx("span", { className: "usage-chart-legend-dot", style: { backgroundColor: colorMap.get(key) } }), key] }, key))) }))] }), _jsxs("div", { className: "usage-chart-right-stack", children: [_jsx("div", { className: "usage-chart-panel", ref: heatmapPanel.ref, children: _jsx(HeatmapView, { bars: heatmapBars, containerWidth: heatmapPanel.width, containerHeight: heatmapPanel.height, hoveredBar: hoveredBar, setHoveredBar: setHoveredBar }) }), stats && (_jsxs("dl", { className: "usage-chart-stats", children: [_jsxs("div", { className: "usage-chart-stat", children: [_jsx("dt", { children: "Peak Day" }), _jsxs("dd", { children: [formatDateLabel(stats.peakDay.date), _jsx("span", { className: "usage-chart-stat-sub", children: formatTokenCount(stats.peakDay.totalTokens) })] })] }), _jsxs("div", { className: "usage-chart-stat", children: [_jsx("dt", { children: "Avg / Session" }), _jsx("dd", { children: formatTokenCount(stats.avgPerSession) })] }), _jsxs("div", { className: "usage-chart-stat", children: [_jsx("dt", { children: "Top Model" }), _jsx("dd", { children: stats.topModel })] }), _jsxs("div", { className: "usage-chart-stat", children: [_jsx("dt", { children: "Top Project" }), _jsx("dd", { children: stats.topProject })] }), _jsxs("div", { className: "usage-chart-stat", children: [_jsx("dt", { children: "Best Streak" }), _jsxs("dd", { children: [stats.maxStreak, "d"] })] })] }))] }), hoveredBar && hoveredBar.totalTokens > 0 && (_jsx(ChartTooltip, { bar: hoveredBar, x: mousePos.x, y: mousePos.y, containerWidth: splitRef.current?.clientWidth ?? 800 }))] })] }));
};
