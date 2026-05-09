import { PRIMARY_NAV_MAX, type PrimaryNavIndex } from "./constants";
const MAX_TICKER_QUERY_LENGTH = 16;
const TICKER_QUERY_ALLOWED_PATTERN = /[^A-Z0-9._/-]/g;

export const isEditableEventTarget = (target: EventTarget | null): boolean => {
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true;
  }

  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.isContentEditable === true || target.contentEditable === "true";
};

export const parsePrimaryNavKey = (key: string): PrimaryNavIndex | null => {
  const n = Number.parseInt(key, 10);
  if (Number.isNaN(n) || n < 1 || n > PRIMARY_NAV_MAX) {
    return null;
  }

  return n as PrimaryNavIndex;
};

export const normalizeTickerQueryInput = (value: string): string =>
  value.toUpperCase().replace(TICKER_QUERY_ALLOWED_PATTERN, "").slice(0, MAX_TICKER_QUERY_LENGTH);
