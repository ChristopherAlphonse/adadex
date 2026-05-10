import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GITHUB_OVERVIEW_GRAPH_HEIGHT, GITHUB_OVERVIEW_GRAPH_WIDTH } from "../app/constants";
import { formatGitHubCommitHoverLabel } from "../app/githubMetrics";
import { ActionButton } from "./ui/ActionButton";
/** Room above y=0 so top Y-axis labels (baseline above grid) are not clipped by the viewBox. */
const GITHUB_OVERVIEW_GRAPH_VIEWBOX_INSET = 18;
const GITHUB_RECENT_COMMITS_LIMIT = 50;
/** Plain-text export for download (UTF-8 `.txt`). */
export const buildGitHistoryText = (commits, repoLabel) => {
    const title = repoLabel.trim() || "repository";
    const lines = [`Git history — ${title}`, `Commits: ${commits.length}`, ""];
    for (let i = 0; i < commits.length; i++) {
        const c = commits[i];
        if (!c)
            continue;
        lines.push("─".repeat(64));
        lines.push(`${c.shortHash}  ${c.subject}`);
        lines.push(`  Hash: ${c.hash}`);
        lines.push(`  Authored: ${c.authoredAt}`);
        lines.push(`  Author: ${c.authorName} <${c.authorEmail}>`);
        const body = c.body.trim();
        if (body.length > 0) {
            lines.push("  Body:");
            for (const line of body.split("\n")) {
                lines.push(`    ${line}`);
            }
        }
        lines.push(`  Stats: ${c.filesChanged} files | +${c.insertions} -${c.deletions}`);
        lines.push("");
    }
    return lines.join("\n");
};
const buildGitHistoryFilename = (repoLabel) => {
    const normalizedRepo = repoLabel
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return `${normalizedRepo || "github"}-git-history.txt`;
};
const formatSparkDate = (date) => {
    if (date.startsWith("n/a"))
        return "";
    const d = new Date(`${date}T00:00:00`);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const buildCommitYTicks = (series) => {
    if (series.length === 0)
        return [];
    const counts = series.map((p) => p.count);
    const maxCount = Math.max(...counts);
    const minCount = Math.min(...counts);
    const range = Math.max(1, maxCount - minCount);
    const H = GITHUB_OVERVIEW_GRAPH_HEIGHT;
    const tickCount = 4;
    const ticks = [];
    for (let i = 0; i <= tickCount; i++) {
        const count = Math.round(minCount + range * (i / tickCount));
        const y = H - ((count - minCount) / range) * H;
        ticks.push({ count, y });
    }
    return ticks;
};
const buildAreaPolygonPoints = (series) => {
    if (series.length === 0)
        return "";
    const H = GITHUB_OVERVIEW_GRAPH_HEIGHT;
    const first = series[0];
    const last = series[series.length - 1];
    if (!first || !last)
        return "";
    const linePoints = series.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    return `${first.x.toFixed(1)},${H} ${linePoints} ${last.x.toFixed(1)},${H}`;
};
const formatRecentCommitTimestamp = (value) => {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) {
        return value;
    }
    return new Date(parsed).toLocaleString("en-US", {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
};
export const GitHubPrimaryView = ({ githubRepoLabel, githubStatusPill, isRefreshingGitHubSummary, onRefresh, githubStarCountLabel, githubOpenIssuesLabel, githubOpenPrsLabel, githubRecentCommits, githubCommitCount30d, githubOverviewHoverLabel, githubOverviewGraphPolylinePoints, githubOverviewGraphSeries, hoveredGitHubOverviewPointIndex, onHoveredGitHubOverviewPointIndexChange, }) => {
    const [hoverCursorPosition, setHoverCursorPosition] = useState(null);
    const [pinnedCommitHash, setPinnedCommitHash] = useState(null);
    const [hoveredCommitHash, setHoveredCommitHash] = useState(null);
    const [commitTooltipY, setCommitTooltipY] = useState(null);
    const recentSectionRef = useRef(null);
    const tooltipRef = useRef(null);
    const activeCommitHash = pinnedCommitHash ?? hoveredCommitHash;
    const activeCommit = activeCommitHash
        ? (githubRecentCommits.find((c) => c.hash === activeCommitHash) ?? null)
        : null;
    const hasGitHistoryExport = githubRecentCommits.length > 0;
    const dismissCommitTooltip = useCallback(() => {
        setPinnedCommitHash(null);
        setCommitTooltipY(null);
    }, []);
    const exportGitHistory = useCallback(() => {
        if (!hasGitHistoryExport) {
            return;
        }
        const blob = new Blob([buildGitHistoryText(githubRecentCommits, githubRepoLabel)], {
            type: "text/plain;charset=utf-8",
        });
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = buildGitHistoryFilename(githubRepoLabel);
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
    }, [githubRecentCommits, githubRepoLabel, hasGitHistoryExport]);
    useEffect(() => {
        if (pinnedCommitHash === null)
            return;
        const handleClickOutside = (event) => {
            const target = event.target;
            if (recentSectionRef.current?.contains(target) || tooltipRef.current?.contains(target)) {
                return;
            }
            dismissCommitTooltip();
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [pinnedCommitHash, dismissCommitTooltip]);
    const yTicks = useMemo(() => buildCommitYTicks(githubOverviewGraphSeries), [githubOverviewGraphSeries]);
    const areaPolygonPoints = useMemo(() => buildAreaPolygonPoints(githubOverviewGraphSeries), [githubOverviewGraphSeries]);
    const xLabelStep = Math.max(1, Math.ceil(githubOverviewGraphSeries.length / 6));
    const hoveredGitHubOverviewPoint = hoveredGitHubOverviewPointIndex !== null
        ? (githubOverviewGraphSeries[hoveredGitHubOverviewPointIndex] ?? null)
        : null;
    const tooltipLabel = hoveredGitHubOverviewPoint
        ? formatGitHubCommitHoverLabel(hoveredGitHubOverviewPoint)
        : null;
    return (_jsx("section", { className: "github-view", "aria-label": "GitHub primary view", children: _jsxs("section", { className: "github-overview", "aria-label": "GitHub overview", children: [_jsxs("header", { className: "github-overview-header", children: [_jsx("h2", { children: githubRepoLabel }), _jsxs("div", { className: "github-overview-header-actions", children: [_jsx("span", { className: "console-status-pill", children: githubStatusPill }), _jsx(ActionButton, { "aria-label": "Refresh GitHub overview data", className: "github-overview-refresh", disabled: isRefreshingGitHubSummary, onClick: onRefresh, size: "dense", variant: "accent", children: isRefreshingGitHubSummary ? "Refreshing..." : "Refresh" })] })] }), _jsxs("div", { className: "github-overview-content", children: [_jsx("section", { className: "github-overview-main", children: _jsxs("section", { className: "github-overview-graph", "aria-label": "GitHub commits graph", children: [_jsxs("div", { className: "github-overview-graph-meta", children: [_jsx("strong", { children: "Commits Per Day" }), _jsx("span", { children: githubOverviewHoverLabel })] }), _jsxs("div", { className: "github-overview-graph-surface", children: [_jsxs("svg", { onMouseLeave: () => {
                                                    onHoveredGitHubOverviewPointIndexChange(null);
                                                    setHoverCursorPosition(null);
                                                }, onMouseMove: (event) => {
                                                    if (githubOverviewGraphSeries.length === 0) {
                                                        return;
                                                    }
                                                    const rect = event.currentTarget.getBoundingClientRect();
                                                    if (rect.width <= 0) {
                                                        return;
                                                    }
                                                    const clampedRatio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
                                                    const viewBox = event.currentTarget.viewBox.baseVal;
                                                    const pointerX = viewBox.x + viewBox.width * clampedRatio;
                                                    const pointerY = Math.max(0, event.clientY - rect.top);
                                                    let nearestPointIndex = 0;
                                                    let nearestDistance = Number.POSITIVE_INFINITY;
                                                    githubOverviewGraphSeries.forEach((point, index) => {
                                                        const distance = Math.abs(point.x - pointerX);
                                                        if (distance < nearestDistance) {
                                                            nearestDistance = distance;
                                                            nearestPointIndex = index;
                                                        }
                                                    });
                                                    if (nearestPointIndex !== hoveredGitHubOverviewPointIndex) {
                                                        onHoveredGitHubOverviewPointIndexChange(nearestPointIndex);
                                                    }
                                                    setHoverCursorPosition({
                                                        x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
                                                        y: Math.max(0, Math.min(rect.height, pointerY)),
                                                    });
                                                }, viewBox: `${-GITHUB_OVERVIEW_GRAPH_VIEWBOX_INSET} ${-GITHUB_OVERVIEW_GRAPH_VIEWBOX_INSET} ${GITHUB_OVERVIEW_GRAPH_WIDTH + GITHUB_OVERVIEW_GRAPH_VIEWBOX_INSET * 2} ${GITHUB_OVERVIEW_GRAPH_HEIGHT + GITHUB_OVERVIEW_GRAPH_VIEWBOX_INSET * 2}`, preserveAspectRatio: "none", role: "presentation", children: [_jsxs("defs", { children: [_jsxs("linearGradient", { id: "commitAreaGrad", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: "var(--accent-primary)", stopOpacity: "0.16" }), _jsx("stop", { offset: "100%", stopColor: "var(--accent-primary)", stopOpacity: "0.01" })] }), _jsxs("linearGradient", { id: "commitLineGrad", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: "#fce8a8" }), _jsx("stop", { offset: "60%", stopColor: "#e8820a" }), _jsx("stop", { offset: "100%", stopColor: "#ff6a00" })] })] }), yTicks.map((tick, index) => (_jsxs("g", { children: [_jsx("line", { x1: 0, y1: tick.y, x2: GITHUB_OVERVIEW_GRAPH_WIDTH, y2: tick.y, className: "github-overview-graph-grid" }), _jsx("text", { x: 4, y: tick.y - 4, className: "github-overview-graph-y-label", children: tick.count })] }, `${tick.count}-${index}`))), areaPolygonPoints && (_jsx("polygon", { points: areaPolygonPoints, fill: "url(#commitAreaGrad)" })), _jsx("polyline", { points: githubOverviewGraphPolylinePoints, stroke: "url(#commitLineGrad)" }), githubOverviewGraphSeries
                                                        .filter((_, i) => i % xLabelStep === 0)
                                                        .map((point) => {
                                                        const label = formatSparkDate(point.date);
                                                        if (!label)
                                                            return null;
                                                        return (_jsx("text", { x: point.x, y: GITHUB_OVERVIEW_GRAPH_HEIGHT + GITHUB_OVERVIEW_GRAPH_VIEWBOX_INSET, className: "github-overview-graph-x-label", children: label }, `xl-${point.date}`));
                                                    }), githubOverviewGraphSeries.map((point, index) => (_jsx("circle", { "aria-label": formatGitHubCommitHoverLabel(point), className: `github-overview-graph-point${hoveredGitHubOverviewPointIndex === index ? " is-active" : ""}`, cx: point.x, cy: point.y, onFocus: () => {
                                                            onHoveredGitHubOverviewPointIndexChange(index);
                                                        }, onMouseEnter: () => {
                                                            onHoveredGitHubOverviewPointIndexChange(index);
                                                        }, r: 6, tabIndex: 0, children: _jsx("title", { children: formatGitHubCommitHoverLabel(point) }) }, `${point.date}-${index}`)))] }), hoverCursorPosition && tooltipLabel && (_jsx("div", { className: "github-overview-graph-tooltip", style: {
                                                    left: `${hoverCursorPosition.x}px`,
                                                    top: `${Math.max(8, hoverCursorPosition.y - 14)}px`,
                                                }, children: tooltipLabel }))] })] }) }), _jsxs("aside", { className: "github-overview-side", "aria-label": "GitHub recent activity", children: [_jsxs("dl", { className: "github-overview-stats", "aria-label": "Repository stats", children: [_jsxs("div", { "aria-label": `Stars ${githubStarCountLabel}`, className: "github-overview-stat", "data-metric": "st", "data-label": "Stars", title: "Stars", children: [_jsx("dt", { children: _jsx("span", { "aria-hidden": "true", className: "github-overview-stat-icon", children: _jsx("svg", { "aria-hidden": "true", focusable: "false", viewBox: "0 0 16 16", children: _jsx("path", { d: "M8 1.5 9.9 5.5 14.3 6 11 9.1 11.9 13.5 8 11.3 4.1 13.5 5 9.1 1.7 6 6.1 5.5z" }) }) }) }), _jsx("dd", { children: githubStarCountLabel })] }), _jsxs("div", { "aria-label": `Open issues ${githubOpenIssuesLabel}`, className: "github-overview-stat", "data-metric": "is", "data-label": "Open issues", title: "Open issues", children: [_jsx("dt", { children: _jsx("span", { "aria-hidden": "true", className: "github-overview-stat-icon", children: _jsxs("svg", { "aria-hidden": "true", focusable: "false", viewBox: "0 0 16 16", children: [_jsx("path", { d: "M8 2.2a5.8 5.8 0 1 0 0 11.6A5.8 5.8 0 0 0 8 2.2z" }), _jsx("path", { d: "M8 5.1v3.6m0 2.2h.01" })] }) }) }), _jsx("dd", { children: githubOpenIssuesLabel })] }), _jsxs("div", { "aria-label": `Open PRs ${githubOpenPrsLabel}`, className: "github-overview-stat", "data-metric": "pr", "data-label": "Open PRs", title: "Open PRs", children: [_jsx("dt", { children: _jsx("span", { "aria-hidden": "true", className: "github-overview-stat-icon", children: _jsx("svg", { "aria-hidden": "true", focusable: "false", viewBox: "0 0 16 16", children: _jsx("path", { d: "M5 2.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM11 9.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM5 6.5v7m0-3.5h4.2" }) }) }) }), _jsx("dd", { children: githubOpenPrsLabel })] }), _jsxs("div", { "aria-label": `Commits in 30 days ${githubCommitCount30d}`, className: "github-overview-stat", "data-metric": "30d", "data-label": "Commits (30d)", title: "Commits (30d)", children: [_jsx("dt", { children: _jsx("span", { "aria-hidden": "true", className: "github-overview-stat-icon", children: _jsx("svg", { "aria-hidden": "true", focusable: "false", viewBox: "0 0 16 16", children: _jsx("path", { d: "M2 11.8h12M4 9.7l2.2-2.2 2 1.7L12 5.6" }) }) }) }), _jsx("dd", { children: githubCommitCount30d })] })] }), _jsxs("section", { className: "github-overview-recent", "aria-label": "Recent commits", ref: recentSectionRef, children: [_jsxs("header", { className: "github-overview-recent-header", children: [_jsx("h3", { children: "Recent commits" }), _jsxs("div", { className: "github-overview-recent-actions", children: [_jsx(ActionButton, { "aria-label": "Download git history", className: "github-overview-export", disabled: !hasGitHistoryExport, onClick: exportGitHistory, size: "dense", variant: "accent", children: "Download git history" }), _jsx("span", { children: `Showing last ${GITHUB_RECENT_COMMITS_LIMIT}` })] })] }), githubRecentCommits.length > 0 ? (_jsx("ol", { className: "github-overview-recent-list", children: githubRecentCommits.map((commit) => (_jsx("li", { children: _jsxs("button", { type: "button", className: `github-overview-recent-item${pinnedCommitHash === commit.hash ? " is-selected" : ""}`, onMouseEnter: (event) => {
                                                        if (pinnedCommitHash) {
                                                            return;
                                                        }
                                                        setHoveredCommitHash(commit.hash);
                                                        const sectionRect = recentSectionRef.current?.getBoundingClientRect();
                                                        if (sectionRect) {
                                                            const itemRect = event.currentTarget.getBoundingClientRect();
                                                            setCommitTooltipY(itemRect.top - sectionRect.top + itemRect.height / 2);
                                                        }
                                                    }, onMouseLeave: () => {
                                                        if (pinnedCommitHash) {
                                                            return;
                                                        }
                                                        setHoveredCommitHash(null);
                                                        setCommitTooltipY(null);
                                                    }, onClick: (event) => {
                                                        if (pinnedCommitHash === commit.hash) {
                                                            dismissCommitTooltip();
                                                            return;
                                                        }
                                                        setPinnedCommitHash(commit.hash);
                                                        const sectionRect = recentSectionRef.current?.getBoundingClientRect();
                                                        if (sectionRect) {
                                                            const itemRect = event.currentTarget.getBoundingClientRect();
                                                            setCommitTooltipY(itemRect.top - sectionRect.top + itemRect.height / 2);
                                                        }
                                                    }, children: [_jsx("span", { "aria-hidden": "true", className: "github-overview-recent-node" }), _jsx("span", { className: "github-overview-recent-sha", children: commit.shortHash }), _jsxs("div", { className: "github-overview-recent-copy", children: [_jsx("p", { className: "github-overview-recent-subject", children: commit.subject }), _jsxs("p", { className: "github-overview-recent-meta", children: [_jsx("span", { children: commit.authorName }), _jsx("span", { children: formatRecentCommitTimestamp(commit.authoredAt) })] })] })] }) }, commit.hash))) })) : (_jsx("p", { className: "github-overview-recent-empty", children: "Recent commit data is unavailable." })), _jsx("div", { ref: tooltipRef, className: `github-overview-recent-tooltip${activeCommit ? " is-visible" : ""}`, style: {
                                                top: commitTooltipY !== null ? `${commitTooltipY}px` : undefined,
                                            }, children: activeCommit && (_jsxs(_Fragment, { children: [_jsxs("p", { className: "github-overview-recent-tooltip-hash", children: [_jsx("span", { children: activeCommit.shortHash }), _jsx("button", { className: "github-overview-recent-tooltip-copy", type: "button", title: "Copy full hash", onClick: () => {
                                                                    navigator.clipboard.writeText(activeCommit.hash);
                                                                }, children: _jsxs("svg", { viewBox: "0 0 16 16", "aria-hidden": "true", children: [_jsx("rect", { x: "5.5", y: "5.5", width: "8", height: "8", rx: "1.2" }), _jsx("path", { d: "M10.5 5.5V3.7a1.2 1.2 0 0 0-1.2-1.2H3.7a1.2 1.2 0 0 0-1.2 1.2v5.6a1.2 1.2 0 0 0 1.2 1.2H5.5" })] }) })] }), _jsxs("p", { className: "github-overview-recent-tooltip-author", children: [activeCommit.authorName, activeCommit.authorEmail ? ` <${activeCommit.authorEmail}>` : ""] }), _jsx("p", { className: "github-overview-recent-tooltip-message", children: activeCommit.body
                                                            ? `${activeCommit.subject}\n\n${activeCommit.body}`
                                                            : activeCommit.subject }), activeCommit.filesChanged > 0 && (_jsxs("p", { className: "github-overview-recent-tooltip-diff", children: [_jsxs("span", { children: [activeCommit.filesChanged, " ", activeCommit.filesChanged === 1 ? "file" : "files"] }), _jsxs("span", { className: "github-overview-recent-tooltip-ins", children: ["+", activeCommit.insertions] }), _jsxs("span", { className: "github-overview-recent-tooltip-del", children: ["-", activeCommit.deletions] })] }))] })) })] })] })] })] }) }));
};
