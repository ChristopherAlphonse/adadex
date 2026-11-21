const PASTED_TAG = /<\/?pasted_content[^>]*>/g;

const TOOL_CALL = /\[(?:Bash|Read|Edit|Write|Grep|Glob|Task|WebFetch|WebSearch):[^\n]*?\](?=\s|$)/g;

/** Strips wrapper tags and light markdown so raw prompts read as plain text. */
export const toPlainText = (value: string): string =>
  value
    .replace(PASTED_TAG, " ")
    .replace(TOOL_CALL, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[`*_#>]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Short single-line gist of a message, cut on a word boundary. */
export const toGist = (value: string, maxLength = 200): string => {
  const plain = toPlainText(value) || (value.trim().length > 0 ? "Ran commands" : "");

  if (plain.length <= maxLength) {
    return plain;
  }

  const cut = plain.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");

  return `${cut.slice(0, lastSpace > maxLength * 0.6 ? lastSpace : maxLength)}…`;
};

export const toTitle = (value: string | null, fallback: string, maxLength = 48): string => {
  if (!value) {
    return fallback;
  }

  const gist = toGist(value, maxLength);

  return gist.length > 0 ? gist : fallback;
};

export const formatRelativeTime = (value: string | null): string => {
  if (!value) {
    return "";
  }

  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) {
    return "";
  }

  const date = new Date(parsed);
  const diffMs = Date.now() - parsed;
  const minute = 60_000;

  if (diffMs < minute) {
    return "now";
  }

  if (diffMs < 60 * minute) {
    return `${Math.floor(diffMs / minute)}m`;
  }

  if (diffMs < 24 * 60 * minute) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export const formatClock = (value: string | null): string => {
  if (!value) {
    return "";
  }

  const parsed = Date.parse(value);

  return Number.isFinite(parsed)
    ? new Date(parsed).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "";
};

export const formatDay = (value: string | null): string => {
  if (!value) {
    return "";
  }

  const parsed = Date.parse(value);

  return Number.isFinite(parsed)
    ? new Date(parsed).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "";
};
