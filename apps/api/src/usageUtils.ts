import { asNumber } from "@adadex/core";

export const toResetIso = (value: unknown): string | null => {
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
  }

  const numberValue = asNumber(value);
  if (numberValue === null) {
    return null;
  }

  const milliseconds = numberValue >= 1_000_000_000_000 ? numberValue : numberValue * 1000;
  return new Date(milliseconds).toISOString();
};
