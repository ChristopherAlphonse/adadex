import type { TerminalAgentProvider } from "./agentRuntime";

export type DeckCoordinationStatus = "idle" | "active" | "blocked" | "needs-review";

export type DeckMascotAppearance = {
  animation: string | null;
  /** Valid: "normal" | "happy" | "angry" | "surprised". "sleepy" is reserved for idle state — never assign on creation. */
  expression: string | null;
  accessory: string | null;
  hairColor: string | null;
  /** @deprecated Use `variant` in the new identity model. */
  /** AgentGlyph variant (role). Maps: codex, opencode, reviewer, planner, builder, debugger, security, custom */
  variant?: string | null;
  /** AgentGlyph mood (state). Maps: neutral, focused, confident, curious, alert, offline */
  mood?: string | null;
  /** @deprecated Use identitySeed for stable visual identity. */
  identitySeed?: string | null;
  /** AgentGlyph density. Maps: minimal, standard, detailed */
  density?: string | null;
  /** AgentGlyph secondary/body color override */
  bodyColor?: string | null;
};

export type DeckAvailableSkill = {
  name: string;
  description: string;
  source: "project" | "user";
};

export type DeckCoordinationSummary = {
  coordinationId: string;
  displayName: string;
  description: string;
  status: DeckCoordinationStatus;
  color: string | null;
  mascot: DeckMascotAppearance;
  scope: {
    paths: string[];
    tags: string[];
  };
  vaultFiles: string[];
  todoTotal: number;
  todoDone: number;
  todoItems: { text: string; done: boolean }[];
  suggestedSkills: string[];
  agentProvider?: TerminalAgentProvider;
  agentModel?: string;
};
