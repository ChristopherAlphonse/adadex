import { useMemo } from "react";

import type { GraphNode } from "../../app/canvas/types";
import { CuteMascot, type CuteMascotState } from "../deck/CuteMascot";
import { mascotStateForExpression } from "../deck/mascotVisuals";

const LINE_MAX = 22;

const splitLabel = (label: string): [string] | [string, string] => {
  if (label.length <= LINE_MAX) return [label];
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

    if (line2.length > LINE_MAX) line2 = `${line2.slice(0, LINE_MAX - 1)}…`;

    return [line1.length > LINE_MAX ? `${line1.slice(0, LINE_MAX - 1)}…` : line1, line2];
  }

  return [
    `${label.slice(0, LINE_MAX - 1)}…`,
    label.slice(LINE_MAX - 1, LINE_MAX * 2 - 2) + (label.length > LINE_MAX * 2 - 2 ? "…" : ""),
  ];
};

const mascotStateForNode = (node: GraphNode): CuteMascotState => {
  const storedExpression = node.mascot?.expression;

  if (storedExpression) return mascotStateForExpression(storedExpression);

  if (
    node.type === "active-session" ||
    (node.agentRuntimeState && node.agentRuntimeState !== "idle")
  ) {
    return "working";
  }

  return node.type === "deck-lead" ? "idle" : "sleeping";
};

type MascotNodeProps = {
  node: GraphNode;
  connectedNodes: GraphNode[];
  isSelected: boolean;
  selectedNodeId: string | null;
  selectedNodeColor: string | null;
  onPointerDown: (e: React.PointerEvent, nodeId: string) => void;
  onClick: (nodeId: string) => void;
};

const buildEdgePath = (
  cx: number,
  cy: number,
  tx: number,
  ty: number,
  targetRadius: number,
  edgeIndex: number,
  edgeCount: number,
): string => {
  const dx = tx - cx;
  const dy = ty - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 1) return "";

  const shortenBy = targetRadius + 2;
  const endRatio = Math.max(0, (dist - shortenBy) / dist);
  const etx = cx + dx * endRatio;
  const ety = cy + dy * endRatio;

  const curvature = edgeCount <= 1 ? 0.3 : (edgeIndex / (edgeCount - 1) - 0.5) * 2;
  const offsetRatio = 0.25 + edgeCount * 0.05;
  const baseOffset = Math.max(35, dist * offsetRatio);

  const offsetX = (-dy / dist) * curvature * baseOffset;
  const offsetY = (dx / dist) * curvature * baseOffset;
  const cpx = (cx + etx) / 2 + offsetX;
  const cpy = (cy + ety) / 2 + offsetY;

  return `M ${cx} ${cy} Q ${cpx} ${cpy} ${etx} ${ety}`;
};

const MASCOT_SIZE = 112;

const DECK_LEAD_MASCOT_SIZE = 168;

const LABEL_BELOW_MASCOT_PX = 6;

const LABEL_OFFSET_X_PX = 7;

const LABEL_OFFSET_Y_PX = 10;

const isEdgeActivityVisible = (target: GraphNode): boolean =>
  target.type === "active-session" &&
  target.hasUserPrompt !== false &&
  target.agentRuntimeState !== undefined &&
  target.agentRuntimeState !== "idle";

const renderEdgeActivityDots = (path: string, color: string, keyPrefix: string) =>
  [0, 1, 2].flatMap((index) => [
    <circle
      key={`${keyPrefix}-trail-${index}`}
      className="canvas-edge-activity-dot canvas-edge-activity-dot--trail"
      r={4.6}
      fill={color}
      opacity={Math.max(0.14, 0.28 - index * 0.04)}
    >
      <animateMotion
        path={path}
        begin={`${index * 0.62}s`}
        dur="1.9s"
        repeatCount="indefinite"
        rotate="auto"
      />
      <animate
        attributeName="r"
        values="3.8;5.2;3.8"
        dur="1.9s"
        begin={`${index * 0.62}s`}
        repeatCount="indefinite"
      />
    </circle>,
    <circle
      key={`${keyPrefix}-dot-${index}`}
      className="canvas-edge-activity-dot"
      r={3.2}
      fill="#fff4cc"
      stroke={color}
      strokeWidth={1.2}
      opacity={Math.max(0.7, 1 - index * 0.08)}
    >
      <animateMotion
        path={path}
        begin={`${index * 0.62}s`}
        dur="1.9s"
        repeatCount="indefinite"
        rotate="auto"
      />
      <animate
        attributeName="r"
        values="2.8;3.8;2.8"
        dur="1.9s"
        begin={`${index * 0.62}s`}
        repeatCount="indefinite"
      />
    </circle>,
  ]);

export const MascotNode = ({
  node,
  connectedNodes,
  isSelected,
  selectedNodeId,
  selectedNodeColor,
  onPointerDown,
  onClick,
}: MascotNodeProps) => {
  const showFocus = isSelected;
  const isDeckLead = node.type === "deck-lead";
  const lines = useMemo(() => splitLabel(node.label), [node.label]);

  const mascotSize = isDeckLead ? DECK_LEAD_MASCOT_SIZE : MASCOT_SIZE;
  const glyphW = mascotSize;
  const glyphH = mascotSize;
  const color = node.color;

  return (
    <g
      className={`canvas-node canvas-node--orchestration${showFocus ? " canvas-node--selected" : ""}`}
      data-node-id={node.id}
      transform={`translate(${node.x}, ${node.y})`}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        onPointerDown(e, node.id);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick(node.id);
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        e.stopPropagation();
        onClick(node.id);
      }}
      style={{ cursor: "grab" }}
    >
      <rect
        x={Math.round(-glyphW / 2)}
        y={Math.round(-glyphH / 2)}
        width={glyphW}
        height={glyphH}
        fill="transparent"
      />

      {connectedNodes.map((target) => {
        const active = isSelected || target.id === selectedNodeId;
        const path = buildEdgePath(0, 0, target.x - node.x, target.y - node.y, target.radius, 0, 1);

        return (
          <g key={target.id}>
            <path
              className="canvas-edge"
              d={path}
              fill="none"
              stroke={active ? (selectedNodeColor ?? color) : "#C0C0C0"}
              strokeWidth={active ? 2 : 1.5}
              strokeOpacity={1}
            />
            <path
              className="canvas-edge-flow"
              d={path}
              fill="none"
              stroke={active ? (selectedNodeColor ?? color) : "#C0C0C0"}
              strokeWidth={active ? 2 : 1.5}
              strokeOpacity={active ? 0.85 : 0.4}
            />
            {isEdgeActivityVisible(target)
              ? renderEdgeActivityDots(
                  path,
                  active ? (selectedNodeColor ?? color) : color,
                  target.id,
                )
              : null}
          </g>
        );
      })}

      {showFocus && <circle className="canvas-node-focus-glow" r={node.radius - 4} fill={color} />}

      <foreignObject
        x={Math.round(-glyphW / 2)}
        y={Math.round(-glyphH / 2)}
        width={glyphW}
        height={glyphH}
        style={{ overflow: "visible", pointerEvents: "none" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        >
          <CuteMascot
            color={color}
            size={mascotSize}
            state={mascotStateForNode(node)}
            title={`${node.label} mascot`}
          />
        </div>
      </foreignObject>

      <text
        x={LABEL_OFFSET_X_PX}
        y={Math.round(glyphH / 2 + LABEL_BELOW_MASCOT_PX + LABEL_OFFSET_Y_PX)}
        textAnchor="middle"
        className="canvas-node-label canvas-node-label--orchestration canvas-node-label--always"
        fill={
          isDeckLead && showFocus
            ? "var(--text-primary, #ffffff)"
            : isDeckLead
              ? "var(--accent-primary, #a3e635)"
              : "var(--accent-secondary, #eab308)"
        }
      >
        <tspan x={LABEL_OFFSET_X_PX} dy="0">
          {lines[0]}
        </tspan>
        {lines[1] && (
          <tspan x={LABEL_OFFSET_X_PX} dy="1.2em">
            {lines[1]}
          </tspan>
        )}
      </text>
    </g>
  );
};
