import { describe, expect, it } from "vitest";

import {
  isEditableEventTarget,
  normalizeTickerQueryInput,
  parsePrimaryNavKey,
} from "../src/app/hotkeys";

describe("hotkeys helpers", () => {
  it("parses primary nav keys from 1 to 5", () => {
    expect(parsePrimaryNavKey("1")).toBe(1);
    expect(parsePrimaryNavKey("2")).toBe(2);
    expect(parsePrimaryNavKey("3")).toBe(3);
    expect(parsePrimaryNavKey("5")).toBe(5);
  });

  it("returns null for unsupported nav keys", () => {
    expect(parsePrimaryNavKey("0")).toBeNull();
    expect(parsePrimaryNavKey("10")).toBeNull();
    expect(parsePrimaryNavKey("x")).toBeNull();
    expect(parsePrimaryNavKey("/")).toBeNull();
  });

  it("detects editable element targets", () => {
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    const select = document.createElement("select");
    const div = document.createElement("div");
    const contentEditableDiv = document.createElement("div");
    contentEditableDiv.contentEditable = "true";

    expect(isEditableEventTarget(input)).toBe(true);
    expect(isEditableEventTarget(textarea)).toBe(true);
    expect(isEditableEventTarget(select)).toBe(true);
    expect(isEditableEventTarget(contentEditableDiv)).toBe(true);
    expect(isEditableEventTarget(div)).toBe(false);
    expect(isEditableEventTarget(null)).toBe(false);
  });

  it("normalizes ticker input to uppercase with allowed symbols and max length", () => {
    expect(normalizeTickerQueryInput("main branch? #1")).toBe("MAINBRANCH1");
    expect(normalizeTickerQueryInput("abc.def/ghi-jkl_mno12345")).toBe("ABC.DEF/GHI-JKL_");
  });
});
