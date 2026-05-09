import { useEffect, useRef } from "react";

const DEFAULT_SIZE = 224;
const MARK_UNITS = 16;
const OUTLINE_COLOR = "#050505";
const HIGHLIGHT_COLOR = "#fff4cc";

export type MascotAnimation = "idle" | "sway" | "walk" | "jog" | "swim-up" | "bounce" | "float";
export type MascotExpression = "normal" | "happy" | "sleepy" | "angry" | "surprised";
export type MascotAccessory = "none" | "long" | "mohawk" | "side-sweep" | "curly" | "afro";

export type OctopusAnimation = MascotAnimation;
export type OctopusExpression = MascotExpression;
export type OctopusAccessory = MascotAccessory;

type MascotSpriteProps = {
  animation?: MascotAnimation;
  expression?: MascotExpression;
  accessory?: MascotAccessory;
  hairColor?: string;
  scale?: number;
  size?: number;
  speedMs?: number;
  className?: string;
  color?: string;
  testId?: string;
  /**
   * When the sprite lives inside an SVG that applies a zoom `scale(...)` (e.g. canvas graph),
   * multiply backing-store resolution by this factor so the bitmap stays sharp when zoomed in.
   */
  graphScale?: number;
};

const getMotionOffset = (animation: MascotAnimation, frame: number, unit: number) => {
  if (animation === "idle") {
    return { x: 0, y: 0, rotation: 0, pulse: 0 };
  }

  const t = frame / 12;
  const sway = Math.sin(t) * unit * 0.22;
  const bob = Math.cos(t * 1.4) * unit * 0.16;

  switch (animation) {
    case "walk":
      return {
        x: sway,
        y: Math.abs(Math.sin(t * 1.5)) * unit * 0.22,
        rotation: sway * 0.08,
        pulse: 0,
      };
    case "jog":
      return {
        x: sway * 1.3,
        y: Math.abs(Math.sin(t * 2.3)) * unit * 0.34,
        rotation: sway * 0.1,
        pulse: 0,
      };
    case "bounce":
      return { x: 0, y: Math.abs(Math.sin(t * 1.8)) * unit * 0.45, rotation: 0, pulse: 0.06 };
    case "float":
      return { x: sway * 0.55, y: bob, rotation: sway * 0.06, pulse: 0.035 };
    case "swim-up":
      return {
        x: sway * 0.75,
        y: -Math.abs(Math.sin(t * 1.3)) * unit * 0.34,
        rotation: sway * 0.08,
        pulse: 0.04,
      };
    default:
      return { x: sway * 0.7, y: bob * 0.45, rotation: sway * 0.06, pulse: 0.025 };
  }
};

const getExpressionAlpha = (expression: MascotExpression) => {
  switch (expression) {
    case "happy":
      return 0.98;
    case "sleepy":
      return 0.72;
    case "angry":
      return 1;
    case "surprised":
      return 0.9;
    default:
      return 0.86;
  }
};

/** Curved arm stroke with outline (deck mascot — avoids six-point / “star” silhouettes). */
const drawArmStroke = (
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  cpx: number,
  cpy: number,
  ex: number,
  ey: number,
  lineWidth: number,
  outlineWidth: number,
  fillColor: string,
  strokeAlpha: number,
) => {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(cpx, cpy, ex, ey);
  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.lineWidth = outlineWidth;
  ctx.stroke();

  ctx.globalAlpha = strokeAlpha;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(cpx, cpy, ex, ey);
  ctx.strokeStyle = fillColor;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.restore();
};

const resolveHairColor = (hairColor: string | undefined): string =>
  hairColor && hairColor.trim().length > 0 ? hairColor : "#5c4033";

const drawAccessoryHair = (
  ctx: CanvasRenderingContext2D,
  accessory: MascotAccessory,
  hairHex: string,
  headCy: number,
  headRx: number,
  headRy: number,
  unit: number,
) => {
  /* With no hairstyle, hair color still needs to affect the preview (picker feedback). */
  if (accessory === "none") {
    ctx.save();
    ctx.fillStyle = hairHex;
    ctx.strokeStyle = OUTLINE_COLOR;
    ctx.lineWidth = Math.max(1, unit * 0.1);
    ctx.lineJoin = "round";

    const crownY = headCy - headRy * 0.88;
    const sideY = headCy - headRy * 0.42;
    ctx.beginPath();
    ctx.moveTo(-headRx * 0.82, sideY);
    ctx.bezierCurveTo(
      -headRx * 0.66,
      crownY - unit * 0.55,
      -headRx * 0.08,
      crownY - unit * 0.9,
      headRx * 0.72,
      crownY - unit * 0.18,
    );
    ctx.bezierCurveTo(
      headRx * 0.42,
      crownY + unit * 0.32,
      headRx * 0.02,
      crownY + unit * 0.42,
      -headRx * 0.3,
      crownY + unit * 0.24,
    );
    ctx.bezierCurveTo(
      -headRx * 0.36,
      crownY + unit * 0.78,
      -headRx * 0.58,
      sideY + unit * 0.12,
      -headRx * 0.82,
      sideY,
    );
    ctx.fill();
    ctx.stroke();

    const browY = headCy - headRy * 0.62;
    for (const dx of [-headRx * 0.42, headRx * 0.42]) {
      ctx.beginPath();
      ctx.ellipse(dx, browY, unit * 0.32, unit * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.fillStyle = hairHex;
  ctx.lineWidth = Math.max(1.2, unit * 0.14);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (accessory) {
    case "long": {
      for (let i = 0; i < 5; i++) {
        const t = i / 4;
        const sx = -headRx * (0.85 - t * 0.35);
        const sy = headCy - headRy * (0.4 + t * 0.15);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(
          sx - unit * (1.8 + t * 0.4),
          sy + unit * (1.2 + t * 0.8),
          sx - unit * (2.4 + t * 0.3),
          sy + unit * (3.5 + t * 0.5),
        );
        ctx.stroke();
      }
      break;
    }
    case "mohawk": {
      const topY = headCy - headRy * 1.05;
      for (let i = -2; i <= 2; i++) {
        const x = i * unit * 0.55;
        ctx.beginPath();
        ctx.moveTo(x * 0.3, headCy - headRy * 0.85);
        ctx.lineTo(x, topY - unit * (1.55 - Math.abs(i) * 0.12));
        ctx.lineTo(x * 0.3 + (i > 0 ? unit * 0.12 : -unit * 0.12), headCy - headRy * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case "side-sweep": {
      ctx.beginPath();
      ctx.moveTo(headRx * 0.2, headCy - headRy * 0.95);
      ctx.bezierCurveTo(
        headRx * 0.85,
        headCy - headRy * 1.22,
        headRx * 1.75,
        headCy - headRy * 0.82,
        headRx * 1.85,
        headCy - headRy * 0.32,
      );
      ctx.bezierCurveTo(
        headRx * 1.35,
        headCy + headRy * 0.08,
        headRx * 0.45,
        headCy - headRy * 0.42,
        headRx * 0.2,
        headCy - headRy * 0.95,
      );
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "curly": {
      const n = 6;
      for (let i = 0; i < n; i++) {
        const a = Math.PI * (0.85 + (i / Math.max(1, n - 1)) * 0.35);
        const cx = Math.cos(a) * headRx * 0.75;
        const cy = headCy + Math.sin(a) * headRy * 0.35 - headRy * 0.55;
        ctx.beginPath();
        ctx.arc(cx, cy, unit * 0.38, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case "afro": {
      const puffs = [
        { x: -0.72, y: -0.94, r: 0.68 },
        { x: -0.28, y: -1.14, r: 0.74 },
        { x: 0.22, y: -1.16, r: 0.78 },
        { x: 0.68, y: -0.94, r: 0.7 },
        { x: -0.92, y: -0.55, r: 0.62 },
        { x: -0.38, y: -0.62, r: 0.7 },
        { x: 0.22, y: -0.64, r: 0.72 },
        { x: 0.82, y: -0.54, r: 0.62 },
      ];
      for (const puff of puffs) {
        ctx.beginPath();
        ctx.arc(headRx * puff.x, headCy + headRy * puff.y, unit * puff.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    default:
      break;
  }
  ctx.restore();
};

const drawMark = (
  ctx: CanvasRenderingContext2D,
  accentColor: string,
  unit: number,
  frame: number,
  animation: MascotAnimation,
  expression: MascotExpression,
  accessory: MascotAccessory,
  hairColor: string | undefined,
) => {
  const width = MARK_UNITS * unit;
  const center = width / 2;
  const motion = getMotionOffset(animation, frame, unit);
  const alpha = getExpressionAlpha(expression);
  const pulse = motion.pulse;
  const headRx = unit * (3.05 + pulse * 0.35);
  const headRy = unit * (2.65 + pulse * 0.3);
  const headCy = -unit * 1.05;
  const lineWidth = Math.max(2, unit * 0.95);
  const outlineWidth = lineWidth + Math.max(2, unit * 0.38);
  /** Seven arms, uneven lengths — breaks symmetry that read like a hexagram + halo. */
  const armSpecs: ReadonlyArray<{ angle: number; reach: number; curl: number }> = [
    { angle: 2.15, reach: 1.05, curl: 0.42 },
    { angle: 2.38, reach: 1.22, curl: 0.38 },
    { angle: 2.58, reach: 0.98, curl: 0.5 },
    { angle: 2.78, reach: 1.18, curl: 0.44 },
    { angle: 2.98, reach: 1.08, curl: 0.48 },
    { angle: 3.2, reach: 0.92, curl: 0.52 },
    { angle: 3.45, reach: 1.12, curl: 0.4 },
  ];

  ctx.clearRect(0, 0, width, width);
  ctx.save();
  ctx.translate(center + motion.x, center + motion.y);
  ctx.rotate((motion.rotation * Math.PI) / 180);

  /* Soft ground shadow — oval, not a “halo” ring behind the head */
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.ellipse(0, unit * 3.2, unit * 4.2, unit * 1.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  for (const spec of armSpecs) {
    const attachX = Math.cos(spec.angle) * headRx * 0.92;
    const attachY = headCy + Math.sin(spec.angle) * headRy * 0.88;
    const reach = unit * 3.4 * spec.reach;
    const midX = attachX + Math.cos(spec.angle + 0.55) * reach * spec.curl;
    const midY = attachY + Math.sin(spec.angle + 0.55) * reach * spec.curl + unit * 0.6;
    const endX = attachX + Math.cos(spec.angle + 0.2) * reach * 1.05;
    const endY = attachY + Math.sin(spec.angle + 0.15) * reach * 1.12 + unit * 1.1;
    drawArmStroke(
      ctx,
      attachX,
      attachY,
      midX,
      midY,
      endX,
      endY,
      lineWidth,
      outlineWidth,
      accentColor,
      alpha,
    );
  }

  ctx.globalAlpha = 1;
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.ellipse(0, headCy, headRx, headRy, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.lineWidth = Math.max(1.5, unit * 0.22);
  ctx.stroke();

  drawAccessoryHair(
    ctx,
    accessory,
    resolveHairColor(hairColor),
    headCy,
    headRx,
    headRy,
    unit,
  );

  ctx.globalAlpha = alpha;
  const eyeY = headCy - unit * 0.35;
  const eyeDx = unit * 1.05;
  ctx.fillStyle = OUTLINE_COLOR;

  const drawEyePair = (ryScale: number, rxScale: number) => {
    for (const dx of [-eyeDx, eyeDx]) {
      ctx.beginPath();
      ctx.ellipse(dx, eyeY, unit * 0.38 * rxScale, unit * 0.48 * ryScale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  switch (expression) {
    case "happy":
      drawEyePair(0.62, 1);
      break;
    case "surprised":
      drawEyePair(1.12, 1.18);
      break;
    case "sleepy":
      drawEyePair(0.32, 1);
      break;
    case "angry":
      drawEyePair(1, 1);
      ctx.lineWidth = Math.max(1.5, unit * 0.2);
      ctx.strokeStyle = OUTLINE_COLOR;
      ctx.beginPath();
      ctx.moveTo(-eyeDx - unit * 0.55, eyeY - unit * 0.78);
      ctx.lineTo(-eyeDx + unit * 0.32, eyeY - unit * 0.52);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(eyeDx + unit * 0.55, eyeY - unit * 0.78);
      ctx.lineTo(eyeDx - unit * 0.32, eyeY - unit * 0.52);
      ctx.stroke();
      break;
    default:
      drawEyePair(1, 1);
  }

  ctx.globalAlpha = 1;
  ctx.fillStyle = HIGHLIGHT_COLOR;
  ctx.beginPath();
  ctx.ellipse(-unit * 1.15, headCy - unit * 0.95, unit * 0.55, unit * 0.42, -0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

const MAX_CANVAS_RESOLUTION_SCALE = 4;

const resolveCanvasResolutionScale = (graphScale?: number): number => {
  if (typeof window === "undefined") return 1;
  const dpr = window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
  const zoom = typeof graphScale === "number" && graphScale > 0 ? graphScale : 1;
  return Math.min(MAX_CANVAS_RESOLUTION_SCALE, Math.max(1, dpr * zoom));
};

export const MascotSprite = ({
  animation = "sway",
  expression = "normal",
  accessory = "none",
  hairColor,
  scale,
  size = DEFAULT_SIZE,
  speedMs = 90,
  className,
  color,
  testId,
  graphScale,
}: MascotSpriteProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const unit = scale ?? size / MARK_UNITS;
  const canvasSize = MARK_UNITS * unit;
  const resolutionScale = resolveCanvasResolutionScale(graphScale);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const backing = Math.max(1, Math.round(canvasSize * resolutionScale));
    canvas.width = backing;
    canvas.height = backing;
    ctx.setTransform(resolutionScale, 0, 0, resolutionScale, 0, 0);
    ctx.imageSmoothingEnabled = true;

    const accentColor =
      color ??
      (getComputedStyle(document.documentElement).getPropertyValue("--accent-primary").trim() ||
        "#a3e635");

    const drawFrame = () => {
      drawMark(ctx, accentColor, unit, frameRef.current, animation, expression, accessory, hairColor);
    };

    frameRef.current = 0;
    drawFrame();

    if (animation === "idle") {
      return;
    }

    const id = window.setInterval(() => {
      frameRef.current = (frameRef.current + 1) % 240;
      drawFrame();
    }, speedMs);

    return () => window.clearInterval(id);
  }, [animation, expression, accessory, hairColor, color, unit, speedMs, canvasSize, resolutionScale]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      width={Math.max(1, Math.round(canvasSize * resolutionScale))}
      height={Math.max(1, Math.round(canvasSize * resolutionScale))}
      style={{
        width: `${canvasSize}px`,
        height: `${canvasSize}px`,
        display: "block",
      }}
      data-testid={testId}
    />
  );
};

export const MascotGlyph = MascotSprite;
export const OctopusGlyph = MascotSprite;
