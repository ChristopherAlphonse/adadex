import type { AgentGlyphAnimation, AgentGlyphMood, Motion } from "./agent-types";

export const getMotion = (
  animation: AgentGlyphAnimation,
  mood: AgentGlyphMood,
  time: number,
  unit: number,
  speedMs: number,
): Motion => {
  if (animation === "idle" || mood === "offline") {
    return { y: 0, bodyPulse: 0, orbit: 0, nodePulse: 0, scan: 0 };
  }

  const pace = Math.max(80, speedMs);
  const t = time / pace;
  const amplitude = mood === "focused" ? 0.55 : mood === "busy" ? 1.1 : 0.8;
  const pulse = (Math.sin(t) + 1) / 2;

  switch (animation) {
    case "breathe":
      return {
        y: Math.sin(t * 0.65) * unit * 0.08 * amplitude,
        bodyPulse: pulse * 0.02,
        orbit: 0,
        nodePulse: pulse,
        scan: 0,
      };
    case "pulse":
      return { y: 0, bodyPulse: pulse * 0.015, orbit: 0, nodePulse: pulse, scan: 0 };
    case "orbit":
      return { y: 0, bodyPulse: pulse * 0.01, orbit: t * 0.02, nodePulse: pulse, scan: 0 };
    case "typing":
      return { y: 0, bodyPulse: 0, orbit: 0, nodePulse: pulse, scan: Math.floor(t * 0.3) };
    case "thinking":
      return {
        y: Math.sin(t * 0.35) * unit * 0.04,
        bodyPulse: 0,
        orbit: t * 0.012,
        nodePulse: pulse,
        scan: 0,
      };
    case "deploying":
      return { y: 0, bodyPulse: pulse * 0.01, orbit: 0, nodePulse: pulse, scan: (t * 0.04) % 1 };
    default:
      return { y: 0, bodyPulse: 0, orbit: 0, nodePulse: 0, scan: 0 };
  }
};

export const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};
