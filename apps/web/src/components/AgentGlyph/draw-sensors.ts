import type { AgentGlyphMood, Palette } from "./agent-types";

export const drawSensors = (
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  unit: number,
  mood: AgentGlyphMood,
) => {
  const eyeY = -unit * 0.68;
  const eyeDx = unit * 0.72;
  const sensorRx = mood === "focused" || mood === "busy" ? unit * 0.2 : unit * 0.22;
  const sensorRy = unit * 0.23;
  const tilt = mood === "curious" ? 0.12 : 0;

  ctx.save();
  ctx.fillStyle = palette.sensor;
  ctx.globalAlpha = mood === "offline" ? 0.36 : 0.62;

  for (const [index, dx] of [-eyeDx, eyeDx].entries()) {
    ctx.beginPath();
    ctx.ellipse(
      dx,
      eyeY + (index === 0 ? -tilt : tilt) * unit,
      sensorRx,
      sensorRy,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  if (mood === "happy" || mood === "curious") {
    ctx.globalAlpha = 0.46;
    ctx.strokeStyle = palette.sensor;
    ctx.lineWidth = Math.max(0.8, unit * 0.055);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, -unit * 0.16, unit * 0.46, 0.16 * Math.PI, 0.84 * Math.PI);
    ctx.stroke();
  }

  ctx.restore();
};
