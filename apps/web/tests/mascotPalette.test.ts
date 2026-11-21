import { describe, expect, it } from "vitest";

import { formatColorForDisplay, MASCOT_COLORS } from "../src/app/mascotPalette";

describe("mascotPalette", () => {
  it("lists saturated coordination colors (no pale mint)", () => {
    expect(MASCOT_COLORS).not.toContain("#d9f99d");
    expect(MASCOT_COLORS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(MASCOT_COLORS).size).toBe(MASCOT_COLORS.length);
    expect(MASCOT_COLORS.every((color) => /^#[0-9a-fA-F]{6}$/.test(color))).toBe(true);
  });

  it("formatColorForDisplay emits hex and rgb", () => {
    expect(formatColorForDisplay("#22c55e")).toBe("#22C55E · rgb(34, 197, 94)");
  });
});
