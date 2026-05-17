import type { AgentGlyphMood, AgentGlyphVariant, Motion, Palette } from "./agent-types";

export const drawBody = (
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  unit: number,
  variant: AgentGlyphVariant,
  mood: AgentGlyphMood,
  motion: Motion,
) => {
  const widthBias = variant === "builder" ? 0.32 : variant === "security" ? -0.16 : 0;
  const posture = mood === "happy" ? -unit * 0.14 : mood === "focused" ? unit * 0.06 : 0;

  const mantleW = unit * (3.75 + widthBias + motion.bodyPulse);
  const mantleH = unit * (3.55 + motion.bodyPulse * 0.65);
  const mantleTop = -unit * 1.95 + posture;
  const mantleBottom = mantleTop + mantleH;

  ctx.save();

  ctx.fillStyle = palette.body;
  ctx.strokeStyle = palette.outline;
  ctx.lineWidth = Math.max(1.5, unit * 0.16);

  ctx.beginPath();
  ctx.moveTo(0, mantleTop);
  ctx.bezierCurveTo(
    mantleW, mantleTop + unit * 0.58,
    mantleW * 0.78, mantleBottom - unit * 0.18,
    0, mantleBottom,
  );
  ctx.bezierCurveTo(
    -mantleW * 0.78, mantleBottom - unit * 0.18,
    -mantleW, mantleTop + unit * 0.58,
    0, mantleTop,
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = palette.secondary;
  ctx.beginPath();
  ctx.moveTo(0, mantleTop + unit * 0.46);
  ctx.bezierCurveTo(
    mantleW * 0.48, mantleTop + unit * 0.8,
    mantleW * 0.38, mantleBottom - unit * 0.58,
    0, mantleBottom - unit * 0.32,
  );
  ctx.bezierCurveTo(
    -mantleW * 0.38, mantleBottom - unit * 0.58,
    -mantleW * 0.48, mantleTop + unit * 0.8,
    0, mantleTop + unit * 0.46,
  );
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = palette.accent;
  ctx.beginPath();
  ctx.arc(0, mantleBottom - unit * 0.04, unit * 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = palette.accent;
  ctx.globalAlpha = mood === "offline" ? 0.28 : 0.48;
  for (const dx of [-unit * 0.6, unit * 0.6]) {
    ctx.beginPath();
    ctx.arc(dx, mantleBottom - unit * 0.2, unit * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
};
