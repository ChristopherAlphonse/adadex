/** Parsed policy. Reading the policy file is the infrastructure's job. */
export interface PolicyRules {
  readonly allow: readonly string[];
  readonly deny: readonly string[];
  readonly ask: readonly string[];
  readonly noWrite: readonly string[];
  readonly writeOnly: readonly string[];
}

export type PolicyDecision =
  | { readonly kind: "allow" }
  | { readonly kind: "ask"; readonly reason: string }
  | { readonly kind: "deny"; readonly reason: string };
