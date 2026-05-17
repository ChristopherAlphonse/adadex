export type AgentGlyphAnimation =
  | "idle"
  | "breathe"
  | "pulse"
  | "orbit"
  | "typing"
  | "thinking"
  | "deploying";

export type AgentGlyphMood = "neutral" | "focused" | "happy" | "curious" | "busy" | "offline";

export type AgentGlyphVariant =
  | "codex"
  | "opencode"
  | "reviewer"
  | "planner"
  | "builder"
  | "debugger"
  | "security"
  | "custom";

export type AgentGlyphAccessory =
  | "none"
  | "glasses"
  | "badge"
  | "visor"
  | "terminal"
  | "node-ring"
  | "shield";

export type AgentGlyphDensity = "minimal" | "standard" | "detailed";

export type AgentGlyphProps = {
  animation?: AgentGlyphAnimation | undefined;
  mood?: AgentGlyphMood | undefined;
  variant?: AgentGlyphVariant | undefined;
  accessory?: AgentGlyphAccessory | undefined;
  density?: AgentGlyphDensity | undefined;
  accentColor?: string | undefined;
  secondaryColor?: string | undefined;
  bodyColor?: string | undefined;
  size?: number | undefined;
  scale?: number | undefined;
  speedMs?: number | undefined;
  className?: string | undefined;
  testId?: string | undefined;
  graphScale?: number | undefined;
  identitySeed?: string | number | undefined;
};

export type Palette = {
  body: string;
  secondary: string;
  accent: string;
  outline: string;
  sensor: string;
};

export type Identity = {
  hash: number;
  armBias: number;
  nodeBias: number;
  dotCount: number;
  accessoryOffset: number;
  accentIntensity: number;
};

export type Motion = {
  y: number;
  bodyPulse: number;
  orbit: number;
  nodePulse: number;
  scan: number;
};

export type ResolvedGlyph = {
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
