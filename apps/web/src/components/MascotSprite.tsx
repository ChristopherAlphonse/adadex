import type {
  AgentGlyphAccessory,
  AgentGlyphAnimation,
  AgentGlyphDensity,
  AgentGlyphMood,
  AgentGlyphProps,
  AgentGlyphVariant,
} from "./AgentGlyph";
import { AgentGlyph } from "./AgentGlyph";

export type {
  AgentGlyphAccessory,
  AgentGlyphAnimation,
  AgentGlyphDensity,
  AgentGlyphMood,
  AgentGlyphProps,
  AgentGlyphVariant,
};
export { AgentGlyph };

export type LegacyMascotAnimation = "idle" | "sway" | "walk" | "jog" | "swim-up" | "float";
export type LegacyMascotExpression = "normal" | "happy" | "sleepy" | "angry" | "surprised";
export type LegacyMascotAccessory = "none" | "long" | "mohawk" | "side-sweep" | "curly" | "afro";

export type MascotAnimation = AgentGlyphAnimation | LegacyMascotAnimation;
export type MascotExpression = AgentGlyphMood | LegacyMascotExpression;
export type MascotAccessory = AgentGlyphAccessory | LegacyMascotAccessory;

export type OctopusAnimation = MascotAnimation;
export type OctopusExpression = MascotExpression;
export type OctopusAccessory = MascotAccessory;

const isAgentAnimation = (value: MascotAnimation | undefined): value is AgentGlyphAnimation =>
  value === "idle" ||
  value === "breathe" ||
  value === "pulse" ||
  value === "orbit" ||
  value === "typing" ||
  value === "thinking" ||
  value === "deploying";

const isAgentMood = (value: MascotExpression | undefined): value is AgentGlyphMood =>
  value === "neutral" ||
  value === "focused" ||
  value === "happy" ||
  value === "curious" ||
  value === "busy" ||
  value === "offline";

const isAgentAccessory = (value: MascotAccessory | undefined): value is AgentGlyphAccessory =>
  value === "none" ||
  value === "glasses" ||
  value === "badge" ||
  value === "visor" ||
  value === "terminal" ||
  value === "node-ring" ||
  value === "shield";

type LegacyMascotProps = {
  animation?: MascotAnimation;
  expression?: MascotExpression;
  accessory?: MascotAccessory;
  hairColor?: string;
  color?: string;
  variant?: string | undefined;
  identitySeed?: string | number | undefined;
};

type MascotSpriteProps = Omit<AgentGlyphProps, "animation" | "mood" | "accessory"> &
  LegacyMascotProps & {
    mood?: AgentGlyphMood;
  };

type ResolvedGlyph = {
  animation: AgentGlyphAnimation;
  mood: AgentGlyphMood;
  variant: AgentGlyphVariant;
  accessory: AgentGlyphAccessory;
  density: AgentGlyphDensity;
  accentColor?: string | undefined;
  secondaryColor?: string | undefined;
  bodyColor?: string | undefined;
  identitySeed?: string | number | undefined;
};

const resolveLegacyGlyph = ({
  animation,
  expression,
  accessory,
  hairColor,
  color,
  mood,
  variant = "custom",
  density = "standard",
  accentColor,
  secondaryColor,
  bodyColor,
  identitySeed,
}: MascotSpriteProps): ResolvedGlyph => {
  const animationMap: Record<LegacyMascotAnimation, AgentGlyphAnimation> = {
    idle: "idle",
    sway: "breathe",
    float: "breathe",
    walk: "pulse",
    jog: "pulse",
    "swim-up": "orbit",
  };
  const expressionMap: Record<LegacyMascotExpression, AgentGlyphMood> = {
    normal: "neutral",
    happy: "happy",
    sleepy: "offline",
    angry: "busy",
    surprised: "curious",
  };
  const accessoryMap: Record<LegacyMascotAccessory, AgentGlyphAccessory> = {
    none: "none",
    long: "node-ring",
    mohawk: "visor",
    "side-sweep": "terminal",
    curly: "glasses",
    afro: "badge",
  };

  const legacyAnimation =
    typeof animation === "string" && animation in animationMap
      ? (animation as LegacyMascotAnimation)
      : "sway";
  const legacyExpression =
    typeof expression === "string" && expression in expressionMap
      ? (expression as LegacyMascotExpression)
      : "normal";
  const legacyAccessory =
    typeof accessory === "string" && accessory in accessoryMap
      ? (accessory as LegacyMascotAccessory)
      : "none";
  const resolvedAnimation = isAgentAnimation(animation) ? animation : animationMap[legacyAnimation];
  const resolvedMood =
    mood ?? (isAgentMood(expression) ? expression : expressionMap[legacyExpression]);
  const resolvedAccessory = isAgentAccessory(accessory) ? accessory : accessoryMap[legacyAccessory];

  return {
    animation: resolvedAnimation,
    mood: resolvedMood,
    variant,
    accessory:
      variant === "security" && resolvedAccessory === "none" ? "shield" : resolvedAccessory,
    density,
    accentColor: accentColor ?? color,
    secondaryColor: secondaryColor ?? hairColor,
    bodyColor,
    identitySeed,
  };
};

export const MascotSprite = (props: MascotSpriteProps) => {
  const resolved = resolveLegacyGlyph(props);
  return (
    <AgentGlyph
      animation={resolved.animation}
      mood={resolved.mood}
      variant={resolved.variant}
      accessory={resolved.accessory}
      density={resolved.density}
      accentColor={resolved.accentColor}
      secondaryColor={resolved.secondaryColor}
      bodyColor={resolved.bodyColor}
      identitySeed={resolved.identitySeed}
      size={props.size}
      scale={props.scale}
      speedMs={props.speedMs}
      className={props.className}
      testId={props.testId}
      graphScale={props.graphScale}
    />
  );
};

export const OrchestratorGlyph = MascotSprite;
export const MascotGlyph = MascotSprite;
export const OctopusGlyph = MascotSprite;
