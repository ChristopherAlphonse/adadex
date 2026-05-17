import type { DeckCoordinationSummary } from "@adadex/core";

import { MASCOT_COLORS } from "../../app/mascotPalette";
import type {
  AgentGlyphAccessory,
  AgentGlyphAnimation,
  AgentGlyphMood,
  AgentGlyphVariant,
} from "../MascotSprite";

export { MASCOT_COLORS };

export const AGENT_ANIMATIONS: AgentGlyphAnimation[] = [
  "idle", "breathe", "pulse", "orbit", "typing", "thinking", "deploying",
];
export const AGENT_MOODS: AgentGlyphMood[] = [
  "neutral", "focused", "happy", "curious", "busy", "offline",
];
export const AGENT_ACCESSORIES: AgentGlyphAccessory[] = [
  "none", "glasses", "badge", "visor", "terminal", "node-ring", "shield",
];
export const AGENT_VARIANTS: AgentGlyphVariant[] = [
  "codex", "opencode", "reviewer", "planner", "builder", "debugger", "security", "custom",
];

export const ANIMATIONS = AGENT_ANIMATIONS;
export const EXPRESSIONS = AGENT_MOODS;
export const ACCESSORIES = AGENT_ACCESSORIES;

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
  animation: AgentGlyphAnimation;
  expression: AgentGlyphMood;
  accessory: AgentGlyphAccessory;
  variant?: AgentGlyphVariant | undefined;
  identitySeed?: string | undefined;
  density?: "minimal" | "standard" | "detailed" | undefined;
  hairColor?: string | undefined;
};

const legacyAnimationMap: Record<string, AgentGlyphAnimation | undefined> = {
  sway: "breathe", float: "breathe", walk: "pulse", jog: "pulse", "swim-up": "orbit",
};
const legacyExpressionMap: Record<string, AgentGlyphMood | undefined> = {
  normal: "neutral", happy: "happy", sleepy: "offline", angry: "busy", surprised: "curious",
};

const toAgentAnimation = (val: string | null | undefined): AgentGlyphAnimation => {
  if (!val) return "idle";
  const anim = val as AgentGlyphAnimation;
  if (AGENT_ANIMATIONS.includes(anim)) return anim;
  return legacyAnimationMap[val] ?? "idle";
};

const toAgentMood = (val: string | null | undefined): AgentGlyphMood => {
  if (!val) return "neutral";
  const mood = val as AgentGlyphMood;
  if (AGENT_MOODS.includes(mood)) return mood;
  return legacyExpressionMap[val] ?? "neutral";
};

const toAgentAccessory = (val: string | null | undefined): AgentGlyphAccessory => {
  if (!val) return "none";
  const acc = val as AgentGlyphAccessory;
  if (AGENT_ACCESSORIES.includes(acc)) return acc;
  const legacyMap: Record<string, AgentGlyphAccessory | undefined> = {
    long: "node-ring", mohawk: "visor", "side-sweep": "terminal", curly: "glasses", afro: "badge",
  };
  return legacyMap[val] ?? "none";
};

export function deriveMascotVisuals(coordination: DeckCoordinationSummary): MascotVisuals {
  const rng = seededRandom(hashString(coordination.coordinationId));
  const stored = coordination.mascot;

  const animation = stored?.variant
    ? toAgentAnimation(stored.variant)
    : toAgentAnimation(stored?.animation);

  const expression = stored?.mood
    ? toAgentMood(stored.mood)
    : toAgentMood(stored?.expression);

  const accessory = stored?.density
    ? toAgentAccessory(stored.density)
    : toAgentAccessory(stored?.accessory);

  return {
    color:
      coordination.color ??
      (MASCOT_COLORS[hashString(coordination.coordinationId) % MASCOT_COLORS.length] as string),
    animation,
    expression,
    accessory,
    variant: (stored?.variant as AgentGlyphVariant | null) ?? undefined,
    identitySeed: stored?.identitySeed ?? coordination.coordinationId,
    density: (stored?.density as "minimal" | "standard" | "detailed" | null) ?? "standard",
    hairColor: stored?.hairColor ?? undefined,
  };
}