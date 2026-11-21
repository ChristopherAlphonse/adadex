import { isString, type DeckCoordinationSummary } from "@adadex/core";

import { MASCOT_COLORS } from "../../app/mascotPalette";
import type { CuteMascotState } from "./CuteMascot";

export { MASCOT_COLORS };

/** Persisted mascot values. Both the legacy and current vocabularies stay readable. */
export type MascotAnimation =
  | "idle"
  | "sway"
  | "walk"
  | "jog"
  | "swim-up"
  | "float"
  | "breathe"
  | "pulse"
  | "orbit"
  | "typing"
  | "thinking"
  | "deploying";

export type MascotExpression =
  | "normal"
  | "happy"
  | "sleepy"
  | "angry"
  | "surprised"
  | "neutral"
  | "focused"
  | "curious"
  | "busy"
  | "offline";

export type MascotAccessory =
  | "none"
  | "long"
  | "mohawk"
  | "side-sweep"
  | "curly"
  | "afro"
  | "glasses"
  | "badge"
  | "visor"
  | "terminal"
  | "node-ring"
  | "shield";

export type MascotVariant =
  | "codex"
  | "opencode"
  | "reviewer"
  | "planner"
  | "builder"
  | "debugger"
  | "security"
  | "custom";

export type MascotDensity = "minimal" | "standard" | "detailed";

export const ANIMATIONS: MascotAnimation[] = [
  "idle",
  "sway",
  "walk",
  "jog",
  "float",
  "swim-up",
  "breathe",
  "pulse",
  "orbit",
  "typing",
  "thinking",
  "deploying",
];

export const EXPRESSIONS: MascotExpression[] = [
  "normal",
  "happy",
  "sleepy",
  "angry",
  "surprised",
  "neutral",
  "focused",
  "curious",
  "busy",
  "offline",
];

export const ACCESSORIES: MascotAccessory[] = [
  "none",
  "long",
  "mohawk",
  "side-sweep",
  "curly",
  "afro",
  "glasses",
  "badge",
  "visor",
  "terminal",
  "node-ring",
  "shield",
];

export const VARIANTS: MascotVariant[] = [
  "codex",
  "opencode",
  "reviewer",
  "planner",
  "builder",
  "debugger",
  "security",
  "custom",
];

const DENSITIES: MascotDensity[] = ["minimal", "standard", "detailed"];

export function hashString(str: string): number {
  let h = 0;

  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }

  return Math.abs(h);
}

export type MascotVisuals = {
  color: string;
  animation: MascotAnimation;
  expression: MascotExpression;
  accessory: MascotAccessory;
  variant?: MascotVariant | undefined;
  identitySeed?: string | undefined;
  density?: MascotDensity | undefined;
  hairColor?: string | undefined;
};

const legacyAnimationMap = {
  sway: "breathe",
  float: "breathe",
  walk: "pulse",
  jog: "pulse",
  "swim-up": "orbit",
} satisfies Record<string, MascotAnimation>;

type LegacyAnimationAlias = keyof typeof legacyAnimationMap;

const isLegacyAnimationAlias = (value: string): value is LegacyAnimationAlias =>
  Object.hasOwn(legacyAnimationMap, value);

const legacyExpressionMap = {
  normal: "neutral",
  happy: "happy",
  sleepy: "offline",
  angry: "busy",
  surprised: "curious",
} satisfies Record<string, MascotExpression>;

type LegacyMoodAlias = keyof typeof legacyExpressionMap;

const isLegacyMoodAlias = (value: string): value is LegacyMoodAlias =>
  Object.hasOwn(legacyExpressionMap, value);

const legacyAccessoryMap = {
  long: "node-ring",
  mohawk: "visor",
  "side-sweep": "terminal",
  curly: "glasses",
  afro: "badge",
} satisfies Record<string, MascotAccessory>;

type LegacyAccessoryAlias = keyof typeof legacyAccessoryMap;

const isLegacyAccessoryAlias = (value: string): value is LegacyAccessoryAlias =>
  Object.hasOwn(legacyAccessoryMap, value);

const isMascotAnimation = (value: string): value is MascotAnimation =>
  ANIMATIONS.some((candidate) => candidate === value);

const isMascotExpression = (value: string): value is MascotExpression =>
  EXPRESSIONS.some((candidate) => candidate === value);

const isMascotAccessory = (value: string): value is MascotAccessory =>
  ACCESSORIES.some((candidate) => candidate === value);

const isMascotVariant = (value: string): value is MascotVariant =>
  VARIANTS.some((candidate) => candidate === value);

const isMascotDensity = (value: string): value is MascotDensity =>
  DENSITIES.some((candidate) => candidate === value);

const toAnimation = (val: string | null | undefined): MascotAnimation => {
  if (!val) return "idle";

  if (isMascotAnimation(val)) return val;

  return isLegacyAnimationAlias(val) ? legacyAnimationMap[val] : "idle";
};

const toExpression = (val: string | null | undefined): MascotExpression => {
  if (!val) return "neutral";

  if (isMascotExpression(val)) return val;

  return isLegacyMoodAlias(val) ? legacyExpressionMap[val] : "neutral";
};

const toAccessory = (val: string | null | undefined): MascotAccessory => {
  if (!val) return "none";

  if (isMascotAccessory(val)) return val;

  return isLegacyAccessoryAlias(val) ? legacyAccessoryMap[val] : "none";
};

/** Map any persisted expression vocabulary onto the moods CuteMascot can draw. */
export const mascotStateForExpression = (
  expression: string | null | undefined,
): CuteMascotState => {
  if (expression === "happy" || expression === "surprised") return "happy";

  if (
    expression === "focused" ||
    expression === "curious" ||
    expression === "busy" ||
    expression === "angry"
  ) {
    return "working";
  }

  if (expression === "offline" || expression === "sleepy") return "sleeping";

  return "idle";
};

export function deriveMascotVisuals(coordination: DeckCoordinationSummary): MascotVisuals {
  const stored = coordination.mascot;

  const animation = stored?.variant ? toAnimation(stored.variant) : toAnimation(stored?.animation);

  const expression = stored?.mood ? toExpression(stored.mood) : toExpression(stored?.expression);

  const accessory = stored?.density ? toAccessory(stored.density) : toAccessory(stored?.accessory);

  const storedVariant = stored?.variant;

  const variant =
    isString(storedVariant) && isMascotVariant(storedVariant) ? storedVariant : undefined;

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
