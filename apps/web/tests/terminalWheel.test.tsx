import { describe, expect, it } from "vitest";

import {
  readViewportY,
  shouldUseManualWheelScroll,
  wheelDeltaToScrollLines,
} from "../src/components/terminalWheel";

describe("wheelDeltaToScrollLines", () => {
  it("returns zero for invalid or neutral wheel deltas", () => {
    expect(wheelDeltaToScrollLines(0, WheelEvent.DOM_DELTA_PIXEL)).toBe(0);
    expect(wheelDeltaToScrollLines(Number.NaN, WheelEvent.DOM_DELTA_PIXEL)).toBe(0);
  });

  it("converts pixel wheel delta to signed terminal lines", () => {
    expect(wheelDeltaToScrollLines(120, WheelEvent.DOM_DELTA_PIXEL)).toBe(3);
    expect(wheelDeltaToScrollLines(-120, WheelEvent.DOM_DELTA_PIXEL)).toBe(-3);
  });

  it("converts line/page delta modes to sensible line movement", () => {
    expect(wheelDeltaToScrollLines(3, WheelEvent.DOM_DELTA_LINE)).toBe(1);
    expect(wheelDeltaToScrollLines(1, WheelEvent.DOM_DELTA_PAGE)).toBe(4);
  });
});

describe("shouldUseManualWheelScroll", () => {
  it("returns false for alternate-screen buffers", () => {
    expect(shouldUseManualWheelScroll({ baseY: 100, type: "alternate" })).toBe(false);
  });

  it("returns false when there is no scrollback history", () => {
    expect(shouldUseManualWheelScroll({ baseY: 0, type: "normal" })).toBe(false);
    expect(shouldUseManualWheelScroll({ type: "normal" })).toBe(false);
  });

  it("returns true for normal buffers with scrollback history", () => {
    expect(shouldUseManualWheelScroll({ baseY: 1, type: "normal" })).toBe(true);
  });
});

describe("readViewportY", () => {
  it("returns null for missing or invalid viewport values", () => {
    expect(readViewportY(undefined)).toBeNull();
    expect(readViewportY({ viewportY: Number.NaN })).toBeNull();
    expect(readViewportY({})).toBeNull();
  });

  it("returns viewport row when available", () => {
    expect(readViewportY({ viewportY: 42 })).toBe(42);
  });
});
