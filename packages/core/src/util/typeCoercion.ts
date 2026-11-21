export type ParsedValue =
  | string
  | number
  | boolean
  | null
  | ParsedValue[]
  | { [key: string]: ParsedValue };

export type ParsedRecord = { [key: string]: ParsedValue };

export const isString = <T>(value: T): value is T & string => typeof value === "string";

export const isNumber = <T>(value: T): value is T & number => typeof value === "number";

export const isBoolean = <T>(value: T): value is T & boolean => typeof value === "boolean";

export const isObjectValue = <T>(value: T): value is T & (object | null) =>
  typeof value === "object";

export const isFunctionValue = <T>(value: T): value is T & Function => typeof value === "function";

export const isSymbolValue = <T>(value: T): value is T & symbol => typeof value === "symbol";

export const isBigIntValue = <T>(value: T): value is T & bigint => typeof value === "bigint";

export const isParsedRecord = <T>(value: T): value is T & ParsedRecord =>
  value !== null && isObjectValue(value) && !Array.isArray(value);

export const asRecord = <T>(value: T): ParsedRecord | null =>
  isParsedRecord(value) ? value : null;

export const asString = <T>(value: T): string | null => (isString(value) ? value : null);

export const asNumber = <T>(value: T): number | null => {
  if (isNumber(value) && Number.isFinite(value)) {
    return value;
  }

  if (isString(value)) {
    const parsed = Number.parseFloat(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};
