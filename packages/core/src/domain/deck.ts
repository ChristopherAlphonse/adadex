export type DeckCoordinationStatus = "idle" | "active" | "blocked" | "needs-review";

export type DeckOctopusAppearance = {
  animation: string | null;
  /** Valid: "normal" | "happy" | "angry" | "surprised". "sleepy" is reserved for idle state — never assign on creation. */
  expression: string | null;
  accessory: string | null;
  hairColor: string | null;
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
  octopus: DeckOctopusAppearance;
  scope: {
    paths: string[];
    tags: string[];
  };
  vaultFiles: string[];
  todoTotal: number;
  todoDone: number;
  todoItems: { text: string; done: boolean }[];
  suggestedSkills: string[];
};
