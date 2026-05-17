import type { AgentGlyphAccessory, Identity, Motion, Palette } from "./agent-types";
import { drawConnectorNode } from "./draw-arms";

const withAlpha = (ctx: CanvasRenderingContext2D, alpha: number, draw: () => void) => {
  const previous = ctx.globalAlpha;
  ctx.globalAlpha = previous * alpha;
  draw();
  ctx.globalAlpha = previous;
};

export const drawAccessory = (
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  unit: number,
  accessory: AgentGlyphAccessory,
  identity: Identity,
  motion: Motion,
) => {
  ctx.save();
  ctx.strokeStyle = palette.accent;
  ctx.fillStyle = palette.accent;
  ctx.lineWidth = Math.max(1, unit * 0.08);
  ctx.lineCap = "round";

  switch (accessory) {
    case "glasses": {
      ctx.globalAlpha = 0.7;
      const gY = -unit * 0.68;
      const gDx = unit * 0.72;
      const gRx = unit * 0.34;
      const gRy = unit * 0.3;
      ctx.beginPath();
      ctx.ellipse(-gDx, gY, gRx, gRy, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(gDx, gY, gRx, gRy, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-gDx + gRx, gY);
      ctx.lineTo(gDx - gRx, gY);
      ctx.stroke();
      break;
    }
    case "badge": {
      ctx.globalAlpha = 0.8;
      const bx = unit * 1.45;
      const by = -unit * 0.32;
      ctx.beginPath();
      ctx.arc(bx, by, unit * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = palette.body;
      ctx.beginPath();
      ctx.arc(bx, by, unit * 0.1, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "visor":
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      ctx.moveTo(-unit * 1.35, -unit * 0.78);
      ctx.lineTo(unit * 1.35, -unit * 0.78);
      ctx.stroke();
      break;
    case "terminal":
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(-unit * 0.34, unit * 0.18);
      ctx.lineTo(-unit * 0.14, unit * 0.34);
      ctx.lineTo(-unit * 0.34, unit * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(unit * 0.02, unit * 0.52);
      ctx.lineTo(unit * 0.34, unit * 0.52);
      ctx.stroke();
      break;
    case "node-ring":
      for (let i = 0; i < 6; i++) {
        const angle = i * ((Math.PI * 2) / 6) + identity.accessoryOffset + motion.orbit;
        withAlpha(ctx, 0.8, () => {
          drawConnectorNode(
            ctx,
            palette,
            Math.cos(angle) * unit * 2.8,
            -unit * 0.3 + Math.sin(angle) * unit * 2.2,
            unit,
            i % 2 === 0,
            motion.nodePulse,
          );
        });
      }
      break;
    case "shield":
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.moveTo(unit * 1.45, -unit * 0.6);
      ctx.lineTo(unit * 1.8, -unit * 0.44);
      ctx.lineTo(unit * 1.72, unit * 0.08);
      ctx.quadraticCurveTo(unit * 1.6, unit * 0.36, unit * 1.45, unit * 0.5);
      ctx.quadraticCurveTo(unit * 1.3, unit * 0.36, unit * 1.18, unit * 0.08);
      ctx.lineTo(unit * 1.1, -unit * 0.44);
      ctx.closePath();
      ctx.stroke();
      break;
    default:
      break;
  }
  ctx.restore();
};
