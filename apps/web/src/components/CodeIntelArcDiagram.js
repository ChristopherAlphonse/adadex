import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { heatColor } from "../app/codeIntelAggregation";
const ROW_HEIGHT = 22;
const LABEL_WIDTH = 100;
const PADDING_Y = 8;
const MAX_ARCS = 40;
const ACCENT = "var(--accent-primary, #a3e635)";
export const CodeIntelArcDiagram = ({ data }) => {
    const containerRef = useRef(null);
    const [size, setSize] = useState({ width: 300, height: 400 });
    const [hoveredPair, setHoveredPair] = useState(null);
    const [hoveredFile, setHoveredFile] = useState(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const measure = useCallback(() => {
        if (containerRef.current) {
            setSize({
                width: containerRef.current.clientWidth,
                height: containerRef.current.clientHeight,
            });
        }
    }, []);
    useEffect(() => {
        measure();
        const observer = new ResizeObserver(measure);
        if (containerRef.current)
            observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [measure]);
    const files = useMemo(() => data.files, [data.files]);
    const pairs = useMemo(() => data.pairs.slice(0, MAX_ARCS), [data.pairs]);
    const fileIndexMap = useMemo(() => {
        const map = new Map();
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file)
                continue;
            map.set(file.file, i);
        }
        return map;
    }, [files]);
    const fileCouplingMap = useMemo(() => {
        const map = new Map();
        for (const p of pairs) {
            if (!map.has(p.fileA))
                map.set(p.fileA, []);
            if (!map.has(p.fileB))
                map.set(p.fileB, []);
            map.get(p.fileA)?.push({ partner: p.fileB, coSessions: p.coSessions });
            map.get(p.fileB)?.push({ partner: p.fileA, coSessions: p.coSessions });
        }
        for (const entries of map.values()) {
            entries.sort((a, b) => b.coSessions - a.coSessions);
        }
        return map;
    }, [pairs]);
    const dotX = LABEL_WIDTH;
    const arcAreaWidth = size.width - LABEL_WIDTH - 8;
    const minSvgHeight = PADDING_Y + files.length * ROW_HEIGHT + PADDING_Y;
    const svgHeight = Math.max(minSvgHeight, size.height);
    const dynamicRowHeight = files.length > 0 ? (svgHeight - PADDING_Y * 2) / files.length : ROW_HEIGHT;
    const maxCoSessions = useMemo(() => {
        let max = 0;
        for (const p of pairs) {
            if (p.coSessions > max)
                max = p.coSessions;
        }
        return max;
    }, [pairs]);
    const fileY = (index) => PADDING_Y + index * dynamicRowHeight + dynamicRowHeight / 2;
    const hoveredPairData = useMemo(() => {
        if (!hoveredPair)
            return null;
        return pairs.find((p) => pairKey(p.fileA, p.fileB) === hoveredPair) ?? null;
    }, [hoveredPair, pairs]);
    const handleMouseMove = useCallback((e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }, []);
    return (_jsxs("div", { className: "code-intel-arc-diagram", ref: containerRef, onMouseMove: handleMouseMove, children: [_jsxs("svg", { className: "code-intel-arc-svg", width: size.width, height: Math.max(svgHeight, size.height), viewBox: `0 0 ${size.width} ${Math.max(svgHeight, size.height)}`, role: "img", "aria-label": "File coupling arc diagram", children: [pairs.map((pair) => {
                        const idxA = fileIndexMap.get(pair.fileA);
                        const idxB = fileIndexMap.get(pair.fileB);
                        if (idxA === undefined || idxB === undefined)
                            return null;
                        const y1 = fileY(idxA);
                        const y2 = fileY(idxB);
                        const span = Math.abs(idxB - idxA);
                        const curveX = dotX + Math.min(span * 16, arcAreaWidth);
                        const key = pairKey(pair.fileA, pair.fileB);
                        const isHovered = hoveredPair === key || hoveredFile === pair.fileA || hoveredFile === pair.fileB;
                        const d = `M ${dotX} ${y1} C ${curveX} ${y1}, ${curveX} ${y2}, ${dotX} ${y2}`;
                        return (_jsxs("g", { children: [_jsx("path", { d: d, fill: "none", stroke: "transparent", strokeWidth: 12, onMouseEnter: () => setHoveredPair(key), onMouseLeave: () => setHoveredPair(null), style: { cursor: "crosshair" } }), _jsx("path", { d: d, fill: "none", stroke: heatColor(pair.coSessions, maxCoSessions), strokeWidth: isHovered ? 1.5 : 0.75, strokeOpacity: isHovered ? 1 : 0.4, className: "code-intel-arc-path", pointerEvents: "none" })] }, key));
                    }), files.map((f, i) => {
                        const y = fileY(i);
                        const isHighlighted = hoveredFile === f.file ||
                            (hoveredPair !== null &&
                                pairs.some((p) => pairKey(p.fileA, p.fileB) === hoveredPair &&
                                    (p.fileA === f.file || p.fileB === f.file)));
                        const shortName = f.file.split("/").pop() ?? f.file;
                        return (_jsxs("g", { onMouseEnter: () => setHoveredFile(f.file), onMouseLeave: () => setHoveredFile(null), className: "code-intel-arc-file-group", children: [_jsx("circle", { cx: dotX, cy: y, r: 3.5, fill: ACCENT, fillOpacity: isHighlighted ? 1 : 0.7, stroke: isHighlighted ? "#fff" : "none", strokeWidth: isHighlighted ? 1.5 : 0 }), _jsx("text", { x: dotX - 8, y: y + 3.5, textAnchor: "end", className: `code-intel-arc-label${isHighlighted ? " code-intel-arc-label--active" : ""}`, children: truncateLabel(shortName, LABEL_WIDTH - 12) })] }, f.file));
                    })] }), hoveredPairData && !hoveredFile && (_jsxs("div", { className: "code-intel-tooltip", style: {
                    left: Math.min(mousePos.x + 12, size.width - 200),
                    top: Math.max(mousePos.y - 40, 4),
                }, children: [_jsxs("div", { className: "code-intel-tooltip-path", children: [shortFileName(hoveredPairData.fileA), " \u2194 ", shortFileName(hoveredPairData.fileB)] }), _jsxs("div", { className: "code-intel-tooltip-value", children: [hoveredPairData.coSessions, " co-edit", hoveredPairData.coSessions !== 1 ? "s" : ""] })] })), hoveredFile && (_jsxs("div", { className: "code-intel-tooltip code-intel-tooltip--node", style: {
                    left: dotX + 12,
                    top: Math.max(fileY(fileIndexMap.get(hoveredFile) ?? 0) - 20, 4),
                }, children: [_jsx("div", { className: "code-intel-tooltip-path", children: hoveredFile }), fileCouplingMap.has(hoveredFile) ? (_jsx("div", { className: "code-intel-tooltip-coupling-list", children: fileCouplingMap.get(hoveredFile)?.map((c) => (_jsxs("div", { className: "code-intel-tooltip-coupling-row", children: [_jsx("span", { className: "code-intel-tooltip-coupling-partner", children: shortFileName(c.partner) }), _jsxs("span", { className: "code-intel-tooltip-coupling-count", children: [c.coSessions, "\u00D7"] })] }, c.partner))) })) : (_jsx("div", { className: "code-intel-tooltip-value", children: "No coupling detected" }))] }))] }));
};
const pairKey = (a, b) => (a < b ? `${a}\0${b}` : `${b}\0${a}`);
const shortFileName = (path) => path.split("/").pop() ?? path;
const truncateLabel = (label, maxWidth) => {
    const charWidth = 6.5;
    const maxChars = Math.floor(maxWidth / charWidth);
    if (label.length <= maxChars)
        return label;
    if (maxChars <= 3)
        return "";
    return `${label.slice(0, maxChars - 1)}\u2026`;
};
