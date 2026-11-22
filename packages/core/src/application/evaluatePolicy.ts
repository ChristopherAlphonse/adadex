import type { PolicyDecision, PolicyRules } from "../domain/policy";

const ALLOW: PolicyDecision = { kind: "allow" };

const deny = (reason: string): PolicyDecision => ({ kind: "deny", reason });

const ask = (reason: string): PolicyDecision => ({ kind: "ask", reason });

const escapeRegex = (c: string): string => c.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&");

/** `*` matches any text, spaces included. Anchored at the start only. */
const shellGlob = (pattern: string): RegExp =>
  new RegExp(`^${[...pattern].map((c) => (c === "*" ? "[\\s\\S]*" : escapeRegex(c))).join("")}`);

const pathGlob = (pattern: string): RegExp => {
  let out = "";

  for (let i = 0; i < pattern.length;) {
    if (pattern.startsWith("**/", i)) {
      out += "(?:[\\s\\S]*/)?";
      i += 3;
    } else if (pattern.startsWith("**", i)) {
      out += "[\\s\\S]*";
      i += 2;
    } else if (pattern[i] === "*") {
      out += "[^/]*";
      i += 1;
    } else {
      out += escapeRegex(pattern[i] ?? "");
      i += 1;
    }
  }

  return new RegExp(`^${out}$`);
};

const anyMatch = (
  patterns: readonly string[],
  text: string,
  compile: (p: string) => RegExp,
): boolean => patterns.some((p) => compile(p).test(text));

// `2>&1` is a descriptor duplication, not a second command.
const FD_DUP = /\d*>&\d+-?/g;

const SPLIT = /&&|\|\||[;|&\n`(){}]|\$\(/;

const REDIRECT = /(?:>>?)\s*("[^"]*"|'[^']*'|[^\s;&|<>()]+)/g;

/** The changed files that match any protected pattern (`**` crosses folders, `*` does not cross a slash). */
export const findProtectedHits = (
  files: readonly string[],
  patterns: readonly string[],
): readonly string[] => files.filter((f) => anyMatch(patterns, f, pathGlob));

export const evaluateWrite = (rules: PolicyRules, absolutePath: string): PolicyDecision => {
  if (anyMatch(rules.noWrite, absolutePath, pathGlob)) return deny(`writing ${absolutePath}`);

  if (rules.writeOnly.length > 0 && !anyMatch(rules.writeOnly, absolutePath, pathGlob)) {
    return deny(`writing ${absolutePath}, which is outside the places this agent may write`);
  }

  for (const scope of rules.scopedWrites ?? []) {
    const root = `${scope.root.replace(/\/+$/, "")}/`;

    if (!absolutePath.startsWith(root)) continue;
    const relative = absolutePath.slice(root.length);

    if (!anyMatch(scope.allow, relative, pathGlob))
      return deny(`writing ${relative}, which this role may not write`);
  }

  return ALLOW;
};

/**
 * Decide a shell command. Precedence: deny, then ask, then allow. A command no rule names needs a human.
 * `resolvePath` turns a redirect target into the absolute path to check (real path resolution is IO,
 * so the caller supplies it).
 */
export const evaluateShell = (
  rules: PolicyRules,
  command: string,
  resolvePath: (raw: string) => string,
): PolicyDecision => {
  const segments = command
    .replace(FD_DUP, "")
    .split(SPLIT)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (segments.length === 0) return deny("an empty command");

  for (const text of [command.trim(), ...segments]) {
    if (anyMatch(rules.deny, text, shellGlob)) return deny(`\`${text}\` is denied`);

    if (anyMatch(rules.ask, text, shellGlob)) return ask(`\`${text}\` needs a human`);
  }

  for (const s of segments) {
    if (!anyMatch(rules.allow, s, shellGlob)) return ask(`\`${s}\` is not on the allow list`);
  }

  for (const match of command.matchAll(REDIRECT)) {
    const target = (match[1] ?? "").replace(/^["']|["']$/g, "");

    if (target.includes("$")) return deny(`a redirect to ${target}, which cannot be resolved`);

    if (["/dev/null", "&1", "&2"].includes(target)) continue;
    const verdict = evaluateWrite(rules, resolvePath(target));

    if (verdict.kind !== "allow") return verdict;
  }

  return ALLOW;
};
