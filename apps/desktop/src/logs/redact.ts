const WHOLE: readonly RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\bsk-[A-Za-z0-9_-]{16,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/gi,
];
/** `name = value` or `name: value` for names that hold secrets. The name stays, the value goes. */
const KEYED =
  /\b(ADADEX_HUMAN_KEY|password|passwd|secret|token|api[_-]?key)(\s*[=:]\s*)("[^"]*"|'[^']*'|\S+)/gi;

/** Hide anything that looks like a credential before it is written to a log. Logs live on disk for a long time. */
export const redact = (text: string): string =>
  WHOLE.reduce((out, re) => out.replace(re, "[redacted]"), text).replace(
    KEYED,
    (_match, name: string, sep: string) => `${name}${sep}[redacted]`,
  );

/** Redact every string inside a value, keeping its shape. */
export const redactDeep = (value: unknown): unknown => {
  if (typeof value === "string") return redact(value);
  if (Array.isArray(value)) return value.map(redactDeep);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactDeep(v)]));
  }
  return value;
};
