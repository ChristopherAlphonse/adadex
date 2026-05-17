"use client";

import { useEffect, useRef } from "react";

import type { AgentGlyphProps, ResolvedGlyph } from "./agent-types";
import { DEFAULT_SIZE, MARK_UNITS, resolveCanvasResolutionScale, resolvePalette } from "./agent-palette";
import { resolveIdentity } from "./agent-identity";
import { getMotion, prefersReducedMotion } from "./agent-motion";
import { drawAgentGlyph } from "./draw-glyph";

export const AgentGlyph = ({
  animation = "idle",
  mood = "neutral",
  variant = "custom",
  accessory = variant === "security" ? "shield" : "none",
  density = "standard",
  accentColor,
  secondaryColor,
  bodyColor,
  scale,
  size = DEFAULT_SIZE,
  speedMs = 300,
  className,
  testId,
  graphScale,
  identitySeed,
}: AgentGlyphProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

    const resolved: ResolvedGlyph = {
      animation,
      mood,
      variant,
      accessory,
      density,
      accentColor,
      secondaryColor,
      bodyColor,
      identitySeed,
    };
    const palette = resolvePalette({ accentColor, bodyColor, secondaryColor, mood });
    const identity = resolveIdentity(identitySeed, variant);
    const shouldReduceMotion = prefersReducedMotion();
    let rafId = 0;
    let timeoutId = 0;

    const render = (time: number) => {
      const effectiveAnimation = shouldReduceMotion ? "idle" : animation;
      const motion = getMotion(effectiveAnimation, mood, time, unit, speedMs);
      drawAgentGlyph(ctx, palette, unit, { ...resolved, animation: effectiveAnimation }, identity, motion);
    };

    render(0);

    if (animation === "idle" || shouldReduceMotion) {
      return;
    }

    const tick = (time: number) => {
      render(time);
      if (typeof window.requestAnimationFrame === "function") {
        rafId = window.requestAnimationFrame(tick);
      } else {
        timeoutId = window.setTimeout(() => tick(performance.now()), speedMs);
      }
    };

    if (typeof window.requestAnimationFrame === "function") {
      rafId = window.requestAnimationFrame(tick);
    } else {
      timeoutId = window.setTimeout(() => tick(performance.now()), speedMs);
    }

    return () => {
      if (rafId && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(rafId);
      }
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [
    animation,
    mood,
    variant,
    accessory,
    density,
    accentColor,
    secondaryColor,
    bodyColor,
    identitySeed,
    unit,
    speedMs,
    canvasSize,
    resolutionScale,
  ]);

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
