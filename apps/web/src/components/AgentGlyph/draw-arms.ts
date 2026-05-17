import type { AgentGlyphMood, Palette } from "./agent-types";

const withAlpha = (ctx: CanvasRenderingContext2D, alpha: number, draw: () => void) => {
  const previous = ctx.globalAlpha;
  ctx.globalAlpha = previous * alpha;
  draw();
  ctx.globalAlpha = previous;
};

export const drawConnectorArm = (
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  unit: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  bend: number,
  mood: AgentGlyphMood,
) => {
  const midX = (startX + endX) / 2 + bend * unit * 0.5;
  const midY = (startY + endY) / 2 + unit * 0.15;
  const alpha = mood === "offline" ? 0.2 : mood === "busy" ? 0.58 : 0.42;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = palette.outline;
  ctx.lineWidth = Math.max(1.3, unit * 0.16);
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.quadraticCurveTo(midX, midY, endX, endY);
  ctx.stroke();

  ctx.strokeStyle = palette.secondary;
  ctx.lineWidth = Math.max(0.9, unit * 0.1);
  withAlpha(ctx, alpha, () => {
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(midX, midY, endX, endY);
    ctx.stroke();
  });
  ctx.restore();
};

export const drawConnectorNode = (
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  x: number,
  y: number,
  unit: number,
  active: boolean,
  pulse: number,
) => {
  const radius = unit * (active ? 0.13 + pulse * 0.03 : 0.08);
  ctx.save();
  ctx.fillStyle = active ? palette.accent : "#d4d4d8";
  ctx.strokeStyle = palette.outline;
  ctx.lineWidth = Math.max(0.7, unit * 0.045);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
};
