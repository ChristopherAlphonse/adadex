import { useEffect, useRef } from "react";

const DEFAULT_SIZE = 224;
const MARK_UNITS = 16;
const OUTLINE_COLOR = "#050505";
const HIGHLIGHT_COLOR = "#fff4cc";

export type MascotAnimation = "idle" | "sway" | "walk" | "jog" | "swim-up" | "bounce" | "float";
export type MascotExpression = "normal" | "happy" | "sleepy" | "angry" | "surprised";
export type MascotAccessory = "none" | "long" | "mohawk" | "side-sweep" | "curly";

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

const drawMark = (
  ctx: CanvasRenderingContext2D,
  accentColor: string,
  unit: number,
  frame: number,
  animation: MascotAnimation,
  expression: MascotExpression,
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

  ctx.globalAlpha = alpha;
  const eyeY = headCy - unit * 0.35;
  const eyeDx = unit * 1.05;
  ctx.fillStyle = OUTLINE_COLOR;
  for (const dx of [-eyeDx, eyeDx]) {
    ctx.beginPath();
    ctx.ellipse(dx, eyeY, unit * 0.38, unit * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.fillStyle = HIGHLIGHT_COLOR;
  ctx.beginPath();
  ctx.ellipse(-unit * 1.15, headCy - unit * 0.95, unit * 0.55, unit * 0.42, -0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

export const MascotSprite = ({
  animation = "sway",
  expression = "normal",
  accessory: _accessory = "none",
  hairColor: _hairColor,
  scale,
  size = DEFAULT_SIZE,
  speedMs = 90,
  className,
  color,
  testId,
}: MascotSpriteProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const unit = scale ?? size / MARK_UNITS;
  const canvasSize = MARK_UNITS * unit;
  void _accessory;
  void _hairColor;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;

    const accentColor =
      color ??
      (getComputedStyle(document.documentElement).getPropertyValue("--accent-primary").trim() ||
        "#d4a017");

    const drawFrame = () => {
      drawMark(ctx, accentColor, unit, frameRef.current, animation, expression);
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
  }, [animation, expression, color, unit, speedMs]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      width={canvasSize}
      height={canvasSize}
      data-testid={testId}
    />
  );
};

export const MascotGlyph = MascotSprite;
export const OctopusGlyph = MascotSprite;
