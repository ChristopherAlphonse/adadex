import type {
  AgentGlyphDensity,
  AgentGlyphVariant,
  Identity,
  Motion,
  Palette,
} from "./agent-types";

export const drawDiagnostics = (
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  unit: number,
  variant: AgentGlyphVariant,
  density: AgentGlyphDensity,
  identity: Identity,
  motion: Motion,
) => {
  if (density === "minimal") return;

  ctx.save();
  ctx.fillStyle = palette.accent;
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = Math.max(1, unit * 0.06);
  ctx.globalAlpha = 0.62 * identity.accentIntensity;

  if (variant === "codex") {
    ctx.beginPath();
    ctx.moveTo(-unit * 0.28, -unit * 1.5);
    ctx.lineTo(-unit * 0.48, -unit * 1.34);
    ctx.lineTo(-unit * 0.28, -unit * 1.18);
    ctx.moveTo(unit * 0.28, -unit * 1.5);
    ctx.lineTo(unit * 0.48, -unit * 1.34);
    ctx.lineTo(unit * 0.28, -unit * 1.18);
    ctx.stroke();
  }

  if (variant === "debugger" || density === "detailed") {
    const activeDot = Math.abs(motion.scan) % Math.max(1, identity.dotCount);
    for (let i = 0; i < identity.dotCount; i++) {
      const x = (i - (identity.dotCount - 1) / 2) * unit * 0.24;
      const active = variant === "debugger" && Math.floor(activeDot) === i;
      ctx.beginPath();
      ctx.arc(x, -unit * 0.12, unit * (active ? 0.05 : 0.035), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (variant === "reviewer") {
    ctx.beginPath();
    ctx.moveTo(-unit * 0.34, unit * 0.18);
    ctx.lineTo(-unit * 0.08, unit * 0.4);
    ctx.lineTo(unit * 0.38, -unit * 0.14);
    ctx.stroke();
  }

  if (motion.scan > 0) {
    ctx.beginPath();
    ctx.moveTo(0, -unit * 0.34);
    ctx.lineTo(0, unit * (0.08 + motion.scan));
    ctx.stroke();
  }

  ctx.restore();
};
