import type { AgentGlyphMood, Palette } from "./agent-types";

export const DEFAULT_SIZE = 224;
export const MARK_UNITS = 16;
export const MAX_CANVAS_RESOLUTION_SCALE = 4;

export const resolveCanvasResolutionScale = (graphScale?: number): number => {
  if (typeof window === "undefined") return 1;
  const dpr = window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
  const zoom = typeof graphScale === "number" && graphScale > 0 ? graphScale : 1;
  return Math.min(MAX_CANVAS_RESOLUTION_SCALE, Math.max(1, dpr * zoom));
};

const resolveAccentColor = (accentColor: string | undefined): string => {
  if (accentColor && accentColor.trim().length > 0) return accentColor;
  if (typeof window === "undefined") return "#7c3aed";
  return (
    getComputedStyle(document.documentElement).getPropertyValue("--accent-primary").trim() ||
    "#7c3aed"
  );
};

export const resolvePalette = ({
  accentColor,
  bodyColor,
  secondaryColor,
  mood,
}: {
  accentColor?: string | undefined;
  bodyColor?: string | undefined;
  secondaryColor?: string | undefined;
  mood: AgentGlyphMood;
}): Palette => {
  const muted = mood === "offline";
  return {
    body: bodyColor ?? (muted ? "#e4e4e7" : "#f4f4f5"),
    secondary: secondaryColor ?? (muted ? "#d4d4d8" : "#e4e4e7"),
    accent: muted ? "#a1a1aa" : resolveAccentColor(accentColor),
    outline: muted ? "#a1a1aa" : "#71717a",
    sensor: muted ? "#a1a1aa" : "#27272a",
  };
};
