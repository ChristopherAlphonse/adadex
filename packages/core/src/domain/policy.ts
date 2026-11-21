/** Parsed policy. Reading the policy file is the infrastructure's job. */
export interface PolicyRules {
  readonly allow: readonly string[];
  readonly deny: readonly string[];
  readonly ask: readonly string[];
  readonly noWrite: readonly string[];
  readonly writeOnly: readonly string[];
  /**
   * Inside each `root`, a write is allowed only when its path relative to the root matches one of `allow`.
   * This is how a role may write some documents in a job's folder and nothing else there.
   */
  readonly scopedWrites?: readonly { readonly root: string; readonly allow: readonly string[] }[];
}

export type PolicyDecision =
  | { readonly kind: "allow" }
  | { readonly kind: "ask"; readonly reason: string }
  | { readonly kind: "deny"; readonly reason: string };
