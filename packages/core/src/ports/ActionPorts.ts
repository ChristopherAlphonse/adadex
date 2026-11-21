import type { ParsedValue } from "../util/typeCoercion";

/** An action's input after the agent or UI boundary has decoded it from JSON. */
export type ActionInput = ParsedValue;

/** The JSON-shaped result an action reports back to its caller. */
export type ActionOutput = ParsedValue;

export type ActionOutcome =
  | { readonly status: "ok"; readonly output: unknown }
  | { readonly status: "denied"; readonly reason: string }
  | { readonly status: "needs-human-click"; readonly reason: string }
  | { readonly status: "error"; readonly message: string };

/** Runs an already-authorized action. The runtime implements it with the process supervisor and git. */
export interface ActionExecutor {
  execute(actionId: string, input: ActionInput): Promise<ActionOutput>;
}

/** Asks a person to approve an `ask` action, usually with a card in the UI. */
export interface ApprovalGate {
  request(actionId: string, reason: string): Promise<boolean>;
}
