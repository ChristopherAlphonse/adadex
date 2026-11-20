import { isString, type DeckCoordinationSummary } from "@adadex/core";

import { MASCOT_COLORS } from "../../app/mascotPalette";
import type {
  AgentGlyphAccessory,
  AgentGlyphAnimation,
  AgentGlyphMood,
  AgentGlyphVariant,
} from "../MascotSprite";

export { MASCOT_COLORS };

export const AGENT_ANIMATIONS: AgentGlyphAnimation[] = [
  "idle",
  "breathe",
  "pulse",
  "orbit",
  "typing",
  "thinking",
  "deploying",
];

export const AGENT_MOODS: AgentGlyphMood[] = [
  "neutral",
  "focused",
  "happy",
  "curious",
  "busy",
  "offline",
];

export const AGENT_ACCESSORIES: AgentGlyphAccessory[] = [
  "none",
  "glasses",
  "badge",
  "visor",
  "terminal",
  "node-ring",
  "shield",
];

export const AGENT_VARIANTS: AgentGlyphVariant[] = [
  "codex",
  "opencode",
  "reviewer",
  "planner",
  "builder",
  "debugger",
  "security",
  "custom",
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

const legacyAnimationMap = {
  sway: "breathe",
  float: "breathe",
  walk: "pulse",
  jog: "pulse",
  "swim-up": "orbit",
} satisfies Record<string, AgentGlyphAnimation>;

type LegacyAnimationAlias = keyof typeof legacyAnimationMap;

const isLegacyAnimationAlias = (value: string): value is LegacyAnimationAlias =>
  Object.hasOwn(legacyAnimationMap, value);

const legacyExpressionMap = {
  normal: "neutral",
  happy: "happy",
  sleepy: "offline",
  angry: "busy",
  surprised: "curious",
} satisfies Record<string, AgentGlyphMood>;

type LegacyMoodAlias = keyof typeof legacyExpressionMap;

const isLegacyMoodAlias = (value: string): value is LegacyMoodAlias =>
  Object.hasOwn(legacyExpressionMap, value);

const legacyAccessoryMap = {
  long: "node-ring",
  mohawk: "visor",
  "side-sweep": "terminal",
  curly: "glasses",
  afro: "badge",
} satisfies Record<string, AgentGlyphAccessory>;

type LegacyAccessoryAlias = keyof typeof legacyAccessoryMap;

const isLegacyAccessoryAlias = (value: string): value is LegacyAccessoryAlias =>
  Object.hasOwn(legacyAccessoryMap, value);

const isAgentAnimation = (value: string): value is AgentGlyphAnimation =>
  AGENT_ANIMATIONS.some((candidate) => candidate === value);

const isAgentMood = (value: string): value is AgentGlyphMood =>
  AGENT_MOODS.some((candidate) => candidate === value);

const isAgentAccessory = (value: string): value is AgentGlyphAccessory =>
  AGENT_ACCESSORIES.some((candidate) => candidate === value);

const isAgentVariant = (value: string): value is AgentGlyphVariant =>
  AGENT_VARIANTS.some((candidate) => candidate === value);

type MascotDensity = NonNullable<MascotVisuals["density"]>;

const MASCOT_DENSITIES: readonly MascotDensity[] = ["minimal", "standard", "detailed"];

const isMascotDensity = (value: string): value is MascotDensity =>
  MASCOT_DENSITIES.some((candidate) => candidate === value);

const toAgentAnimation = (val: string | null | undefined): AgentGlyphAnimation => {
  if (!val) return "idle";

  if (isAgentAnimation(val)) return val;

  return isLegacyAnimationAlias(val) ? legacyAnimationMap[val] : "idle";
};

const toAgentMood = (val: string | null | undefined): AgentGlyphMood => {
  if (!val) return "neutral";

  if (isAgentMood(val)) return val;

  return isLegacyMoodAlias(val) ? legacyExpressionMap[val] : "neutral";
};

const toAgentAccessory = (val: string | null | undefined): AgentGlyphAccessory => {
  if (!val) return "none";

  if (isAgentAccessory(val)) return val;

  return isLegacyAccessoryAlias(val) ? legacyAccessoryMap[val] : "none";
};

export function deriveMascotVisuals(coordination: DeckCoordinationSummary): MascotVisuals {
  const _rng = seededRandom(hashString(coordination.coordinationId));
  const stored = coordination.mascot;

  const animation = stored?.variant
    ? toAgentAnimation(stored.variant)
    : toAgentAnimation(stored?.animation);

  const expression = stored?.mood ? toAgentMood(stored.mood) : toAgentMood(stored?.expression);

  const accessory = stored?.density
    ? toAgentAccessory(stored.density)
    : toAgentAccessory(stored?.accessory);

  const storedVariant = stored?.variant;

  const variant =
    isString(storedVariant) && isAgentVariant(storedVariant) ? storedVariant : undefined;

  const storedDensity = stored?.density;

  const density =
    isString(storedDensity) && isMascotDensity(storedDensity) ? storedDensity : "standard";

  return {
    color:
      coordination.color ??
      MASCOT_COLORS[hashString(coordination.coordinationId) % MASCOT_COLORS.length] ??
      MASCOT_COLORS[0],
    animation,
    expression,
    accessory,
    variant,
    identitySeed: stored?.identitySeed ?? coordination.coordinationId,
    density,
    hairColor: stored?.hairColor ?? undefined,
  };
}
