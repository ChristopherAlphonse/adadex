import { jsx as _jsx } from "react/jsx-runtime";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MascotSprite } from "../src/components/MascotSprite";
const originalGetContext = HTMLCanvasElement.prototype.getContext;
const createContextStub = () => ({
    imageSmoothingEnabled: true,
    globalAlpha: 1,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    setTransform: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    ellipse: vi.fn(),
    arc: vi.fn(),
});
afterEach(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        configurable: true,
        value: originalGetContext,
    });
});
describe("MascotSprite", () => {
    it("draws visible hair color feedback even when no hairstyle is selected", () => {
        const ctx = createContextStub();
        Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
            configurable: true,
            value: () => ctx,
        });
        render(_jsx(MascotSprite, { animation: "idle", accessory: "none", hairColor: "#e04020", color: "#a3e635", size: 160 }));
        expect(ctx.bezierCurveTo).toHaveBeenCalled();
        expect(ctx.fillStyle).toBe("#fff4cc");
    });
});
