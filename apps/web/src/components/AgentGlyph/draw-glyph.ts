import type { Identity, Motion, Palette, ResolvedGlyph } from "./agent-types";
import { drawAccessory } from "./draw-accessories";
import { drawConnectorArm, drawConnectorNode } from "./draw-arms";
import { drawBody } from "./draw-body";
import { drawDiagnostics } from "./draw-diagnostics";
import { drawSensors } from "./draw-sensors";

const MARK_UNITS = 16;

const withAlpha = (ctx: CanvasRenderingContext2D, alpha: number, draw: () => void) => {
  const previous = ctx.globalAlpha;
  ctx.globalAlpha = previous * alpha;
  draw();
  ctx.globalAlpha = previous;
};

const getArmCount = (density: ResolvedGlyph["density"]): number => {
  if (density === "minimal") return 0;
  if (density === "detailed") return 4;
  return 2;
};

export const drawAgentGlyph = (
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  unit: number,
  resolved: ResolvedGlyph,
  identity: Identity,
  motion: Motion,
) => {
  const width = MARK_UNITS * unit;
  const center = width / 2;
  const hasConnectorAccessory =
    resolved.accessory === "node-ring" || resolved.animation === "orbit";
  const armCount = hasConnectorAccessory ? getArmCount(resolved.density) : 0;
  const moodLift = resolved.mood === "happy" ? -unit * 0.22 : 0;

  ctx.clearRect(0, 0, width, width);
  ctx.save();
  ctx.translate(center, center + motion.y + moodLift);

  withAlpha(ctx, resolved.mood === "offline" ? 0.1 : 0.08, () => {
    ctx.fillStyle = "#18181b";
    ctx.beginPath();
    ctx.ellipse(0, unit * 2.2, unit * 3.5, unit * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  if (hasConnectorAccessory) {
    ctx.save();
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = Math.max(0.8, unit * 0.05);
    ctx.globalAlpha = resolved.mood === "offline" ? 0.12 : 0.28;
    ctx.beginPath();
    ctx.ellipse(0, -unit * 0.55, unit * 4.3, unit * 2.7, motion.orbit, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  const angleStart = Math.PI * 0.28;
  const angleEnd = Math.PI * 0.72;
  const spacing =
    resolved.variant === "opencode" ? 1.08 : resolved.variant === "security" ? 0.92 : 1;

  for (let i = 0; i < armCount; i++) {
    const ratio = armCount === 1 ? 0.5 : i / (armCount - 1);
    const angle = angleStart + (angleEnd - angleStart) * ratio;
    const side = ratio < 0.5 ? -1 : 1;
    const spread = (ratio - 0.5) * spacing;
    const startX = Math.cos(angle) * unit * 1.45 * side;
    const startY = unit * (1.05 + Math.sin(angle) * 0.12);
    const endX = spread * unit * 3.4 + identity.nodeBias * unit * 0.35;
    const endY = unit * (2.0 + Math.sin(ratio * Math.PI) * 0.55 + identity.armBias * 0.45);
    const bend = side * (0.32 + ratio * 0.12 + identity.armBias * 0.35);
    const active =
      resolved.mood === "curious"
        ? i === Math.floor(armCount * 0.72)
        : resolved.variant === "builder" || resolved.animation === "deploying"
          ? i >= armCount - 2
          : i % 3 === 0;

    drawConnectorArm(ctx, palette, unit, startX, startY, endX, endY, bend, resolved.mood);
    drawConnectorNode(ctx, palette, endX, endY, unit, active, motion.nodePulse);
  }

  drawBody(ctx, palette, unit, resolved.variant, resolved.mood, motion);
  drawSensors(ctx, palette, unit, resolved.mood);
  drawDiagnostics(ctx, palette, unit, resolved.variant, resolved.density, identity, motion);
  drawAccessory(ctx, palette, unit, resolved.accessory, identity, motion);
  ctx.restore();
};
