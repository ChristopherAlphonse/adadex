import { describe, expect, it } from "vitest";
import { MASCOT_COLORS, formatColorForDisplay } from "../src/app/mascotPalette";
describe("mascotPalette", () => {
    it("lists saturated coordination colors (no pale mint)", () => {
        expect(MASCOT_COLORS).not.toContain("#d9f99d");
        expect(MASCOT_COLORS.length).toBeGreaterThanOrEqual(4);
    });
    it("formatColorForDisplay emits hex and rgb", () => {
        expect(formatColorForDisplay("#22c55e")).toBe("#22C55E · rgb(34, 197, 94)");
    });
});
