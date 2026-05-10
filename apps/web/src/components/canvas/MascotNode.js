import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from "react";
import { MascotGlyph, } from "../MascotSprite";
const LINE_MAX = 22;
const splitLabel = (label) => {
    if (label.length <= LINE_MAX)
        return [label];
    const mid = Math.floor(label.length / 2);
    let best = -1;
    for (let i = 0; i < label.length; i++) {
        if (label[i] === " " && (best === -1 || Math.abs(i - mid) < Math.abs(best - mid))) {
            best = i;
        }
    }
    if (best > 0 && best < label.length - 1) {
        const line1 = label.slice(0, best);
        let line2 = label.slice(best + 1);
        if (line2.length > LINE_MAX)
            line2 = `${line2.slice(0, LINE_MAX - 1)}…`;
        return [line1.length > LINE_MAX ? `${line1.slice(0, LINE_MAX - 1)}…` : line1, line2];
    }
    return [
        `${label.slice(0, LINE_MAX - 1)}…`,
        label.slice(LINE_MAX - 1, LINE_MAX * 2 - 2) + (label.length > LINE_MAX * 2 - 2 ? "…" : ""),
    ];
};
const ANIMATIONS = ["sway", "walk", "jog", "float", "swim-up"];
const EXPRESSIONS = ["normal", "happy", "angry", "surprised"];
const ACCESSORIES = [
    "none",
    "none",
    "long",
    "mohawk",
    "side-sweep",
    "curly",
    "afro",
];
function hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}
function seededRandom(seed) {
    let s = seed;
    return () => {
        s = (s * 16807 + 0) % 2147483647;
        return (s - 1) / 2147483646;
    };
}
function deriveNodeMascotVisuals(node) {
    const rng = seededRandom(hashString(node.coordinationId));
    const stored = node.mascot;
    return {
        animation: stored?.animation ??
            ANIMATIONS[Math.floor(rng() * ANIMATIONS.length)],
        expression: stored?.expression ??
            EXPRESSIONS[Math.floor(rng() * EXPRESSIONS.length)],
        accessory: stored?.accessory ??
            ACCESSORIES[Math.floor(rng() * ACCESSORIES.length)],
        hairColor: stored?.hairColor ?? undefined,
    };
}
const buildEdgePath = (cx, cy, tx, ty, targetRadius, edgeIndex, edgeCount) => {
    const dx = tx - cx;
    const dy = ty - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1)
        return "";
    // Shorten the endpoint so the edge stops at the target node's border
    const shortenBy = targetRadius + 2;
    const endRatio = Math.max(0, (dist - shortenBy) / dist);
    const etx = cx + dx * endRatio;
    const ety = cy + dy * endRatio;
    // Curvature — perpendicular offset for quadratic Bézier control point
    // Single edges get a default curve; multi-edges fan out
    const curvature = edgeCount <= 1 ? 0.3 : (edgeIndex / (edgeCount - 1) - 0.5) * 2;
    const offsetRatio = 0.25 + edgeCount * 0.05;
    const baseOffset = Math.max(35, dist * offsetRatio);
    // Perpendicular to source→target direction (unit normal: -dy/dist, dx/dist)
    const offsetX = (-dy / dist) * curvature * baseOffset;
    const offsetY = (dx / dist) * curvature * baseOffset;
    const cpx = (cx + etx) / 2 + offsetX;
    const cpy = (cy + ety) / 2 + offsetY;
    return `M ${cx} ${cy} Q ${cpx} ${cpy} ${etx} ${ety}`;
};
const GLYPH_SCALE = 4;
const GLYPH_W = 112;
const GLYPH_H = 120;
/** Ground shadow ellipse in `MascotSprite` drawMark: cy = unit * 3.2, ry = unit * 1.35 */
const MASCOT_SHADOW_BOTTOM_IN_UNITS = 3.2 + 1.35;
const LABEL_BELOW_SHADOW_PX = 8;
const LABEL_OFFSET_X_PX = 7;
const LABEL_OFFSET_Y_PX = 10;
const isEdgeActivityVisible = (target) => target.type === "active-session" &&
    target.hasUserPrompt !== false &&
    target.agentRuntimeState !== undefined &&
    target.agentRuntimeState !== "idle";
const renderEdgeActivityDots = (path, color, keyPrefix) => [0, 1, 2].flatMap((index) => [
    _jsxs("circle", { className: "canvas-edge-activity-dot canvas-edge-activity-dot--trail", r: 4.6, fill: color, opacity: Math.max(0.14, 0.28 - index * 0.04), children: [_jsx("animateMotion", { path: path, begin: `${index * 0.62}s`, dur: "1.9s", repeatCount: "indefinite", rotate: "auto" }), _jsx("animate", { attributeName: "r", values: "3.8;5.2;3.8", dur: "1.9s", begin: `${index * 0.62}s`, repeatCount: "indefinite" })] }, `${keyPrefix}-trail-${index}`),
    _jsxs("circle", { className: "canvas-edge-activity-dot", r: 3.2, fill: "#fff4cc", stroke: color, strokeWidth: 1.2, opacity: Math.max(0.7, 1 - index * 0.08), children: [_jsx("animateMotion", { path: path, begin: `${index * 0.62}s`, dur: "1.9s", repeatCount: "indefinite", rotate: "auto" }), _jsx("animate", { attributeName: "r", values: "2.8;3.8;2.8", dur: "1.9s", begin: `${index * 0.62}s`, repeatCount: "indefinite" })] }, `${keyPrefix}-dot-${index}`),
]);
export const MascotNode = ({ node, connectedNodes, isSelected, selectedNodeId, selectedNodeColor, graphScale, onPointerDown, onClick, }) => {
    const showFocus = isSelected;
    const isDeckLead = node.type === "deck-lead";
    const lines = useMemo(() => splitLabel(node.label), [node.label]);
    const visuals = useMemo(() => isDeckLead
        ? { animation: "sway", expression: "normal", accessory: "none" }
        : deriveNodeMascotVisuals(node), [node, isDeckLead]);
    const glyphScale = isDeckLead ? 6 : GLYPH_SCALE;
    const glyphW = Math.round(GLYPH_W * (glyphScale / GLYPH_SCALE));
    const glyphH = Math.round(GLYPH_H * (glyphScale / GLYPH_SCALE));
    const color = node.color;
    return (_jsxs("g", { className: `canvas-node canvas-node--orchestration${showFocus ? " canvas-node--selected" : ""}`, "data-node-id": node.id, transform: `translate(${node.x}, ${node.y})`, onPointerDown: (e) => {
            if (e.button !== 0)
                return;
            e.stopPropagation();
            onPointerDown(e, node.id);
        }, onClick: (e) => {
            e.stopPropagation();
            onClick(node.id);
        }, onKeyDown: (e) => {
            if (e.key !== "Enter" && e.key !== " ")
                return;
            e.preventDefault();
            e.stopPropagation();
            onClick(node.id);
        }, style: { cursor: "grab" }, children: [_jsx("rect", { x: Math.round(-glyphW / 2), y: Math.round(-glyphH / 2), width: glyphW, height: glyphH, fill: "transparent" }), connectedNodes.map((target) => {
                const active = isSelected || target.id === selectedNodeId;
                const path = buildEdgePath(0, 0, target.x - node.x, target.y - node.y, target.radius, 0, 1);
                return (_jsxs("g", { children: [_jsx("path", { className: "canvas-edge", d: path, fill: "none", stroke: active ? (selectedNodeColor ?? color) : "#C0C0C0", strokeWidth: active ? 2 : 1.5, strokeOpacity: 1 }), isEdgeActivityVisible(target)
                            ? renderEdgeActivityDots(path, active ? (selectedNodeColor ?? color) : color, target.id)
                            : null] }, target.id));
            }), showFocus && _jsx("circle", { className: "canvas-node-focus-glow", r: node.radius - 4, fill: color }), _jsx("foreignObject", { x: Math.round(-glyphW / 2), y: Math.round(-glyphH / 2), width: glyphW, height: glyphH, style: { overflow: "visible", pointerEvents: "none" }, children: _jsx("div", { style: {
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "100%",
                        height: "100%",
                        pointerEvents: "none",
                    }, children: _jsx(MascotGlyph, { ...(isDeckLead ? {} : { color }), animation: visuals.animation, expression: visuals.expression, accessory: visuals.accessory, ...(visuals.hairColor ? { hairColor: visuals.hairColor } : {}), scale: glyphScale, graphScale: graphScale }) }) }), _jsxs("text", { x: LABEL_OFFSET_X_PX, y: Math.round(glyphScale * MASCOT_SHADOW_BOTTOM_IN_UNITS + LABEL_BELOW_SHADOW_PX + LABEL_OFFSET_Y_PX), textAnchor: "middle", className: "canvas-node-label canvas-node-label--orchestration canvas-node-label--always", fill: isDeckLead && showFocus
                    ? "var(--text-primary, #ffffff)"
                    : isDeckLead
                        ? "var(--accent-primary, #a3e635)"
                        : "var(--accent-secondary, #eab308)", children: [_jsx("tspan", { x: LABEL_OFFSET_X_PX, dy: "0", children: lines[0] }), lines[1] && (_jsx("tspan", { x: LABEL_OFFSET_X_PX, dy: "1.2em", children: lines[1] }))] })] }));
};
