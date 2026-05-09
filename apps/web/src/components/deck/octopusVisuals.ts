import type { DeckCoordinationSummary } from "@adadex/core";
import type { OctopusAccessory, OctopusAnimation, OctopusExpression } from "../EmptyOctopus";

// ─── Octopus visual derivation (seeded from tentacle id) ────────────────────

export const OCTOPUS_COLORS = [
  "#ff6b2b",
  "#ff2d6b",
  "#00ffaa",
  "#bf5fff",
  "#00c8ff",
  "#ffee00",
  "#39ff14",
  "#ff4df0",
  "#00fff7",
  "#ff9500",
];

export const ANIMATIONS: OctopusAnimation[] = ["sway", "walk", "jog", "bounce", "float", "swim-up"];
export const EXPRESSIONS: OctopusExpression[] = ["normal", "happy", "angry", "surprised"];
export const ACCESSORIES: OctopusAccessory[] = [
  "none",
  "none",
  "long",
  "mohawk",
  "side-sweep",
  "curly",
];

export function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export type OctopusVisuals = {
  color: string;
  animation: OctopusAnimation;
  expression: OctopusExpression;
  accessory: OctopusAccessory;
  hairColor?: string | undefined;
};

export function deriveOctopusVisuals(tentacle: DeckCoordinationSummary): OctopusVisuals {
  const rng = seededRandom(hashString(tentacle.coordinationId));
  const stored = tentacle.octopus;
  return {
    color:
      tentacle.color ??
      (OCTOPUS_COLORS[hashString(tentacle.coordinationId) % OCTOPUS_COLORS.length] as string),
    animation:
      (stored?.animation as OctopusAnimation | null) ??
      (ANIMATIONS[Math.floor(rng() * ANIMATIONS.length)] as OctopusAnimation),
    expression:
      (stored?.expression as OctopusExpression | null) ??
      (EXPRESSIONS[Math.floor(rng() * EXPRESSIONS.length)] as OctopusExpression),
    accessory:
      (stored?.accessory as OctopusAccessory | null) ??
      (ACCESSORIES[Math.floor(rng() * ACCESSORIES.length)] as OctopusAccessory),
    hairColor: stored?.hairColor ?? undefined,
  };
}
