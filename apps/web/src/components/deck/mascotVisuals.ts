import type { DeckCoordinationSummary } from "@adadex/core";
import type { MascotAccessory, MascotAnimation, MascotExpression } from "../MascotSprite";

// ─── Mascot visual derivation (seeded from coordination id) ───────────────

export const MASCOT_COLORS = [
  "#a3e635",
  "#eab308",
  "#84cc16",
  "#d9f99d",
];

export const ANIMATIONS: MascotAnimation[] = ["sway", "walk", "jog", "bounce", "float", "swim-up"];
export const EXPRESSIONS: MascotExpression[] = ["normal", "happy", "angry", "surprised"];
export const ACCESSORIES: MascotAccessory[] = [
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

export type MascotVisuals = {
  color: string;
  animation: MascotAnimation;
  expression: MascotExpression;
  accessory: MascotAccessory;
  hairColor?: string | undefined;
};

export function deriveMascotVisuals(coordination: DeckCoordinationSummary): MascotVisuals {
  const rng = seededRandom(hashString(coordination.coordinationId));
  const stored = coordination.mascot;
  return {
    color:
      coordination.color ??
      (MASCOT_COLORS[hashString(coordination.coordinationId) % MASCOT_COLORS.length] as string),
    animation:
      (stored?.animation as MascotAnimation | null) ??
      (ANIMATIONS[Math.floor(rng() * ANIMATIONS.length)] as MascotAnimation),
    expression:
      (stored?.expression as MascotExpression | null) ??
      (EXPRESSIONS[Math.floor(rng() * EXPRESSIONS.length)] as MascotExpression),
    accessory:
      (stored?.accessory as MascotAccessory | null) ??
      (ACCESSORIES[Math.floor(rng() * ACCESSORIES.length)] as MascotAccessory),
    hairColor: stored?.hairColor ?? undefined,
  };
}
