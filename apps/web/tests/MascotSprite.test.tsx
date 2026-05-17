import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentGlyph, MascotSprite } from "../src/components/MascotSprite";

const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalDevicePixelRatio = Object.getOwnPropertyDescriptor(window, "devicePixelRatio");
const originalMatchMedia = Object.getOwnPropertyDescriptor(window, "matchMedia");
const originalRequestAnimationFrame = Object.getOwnPropertyDescriptor(
  window,
  "requestAnimationFrame",
);
const originalCancelAnimationFrame = Object.getOwnPropertyDescriptor(
  window,
  "cancelAnimationFrame",
);

const restoreWindowProperty = (name: keyof Window, descriptor: PropertyDescriptor | undefined) => {
  if (descriptor) {
    Object.defineProperty(window, name, descriptor);
    return;
  }

  delete (window as unknown as Record<keyof Window, unknown>)[name];
};

const createContextStub = () => {
  const fillStyleValues: string[] = [];
  const strokeStyleValues: string[] = [];
  let fillStyle = "";
  let strokeStyle = "";

  const ctx = {
    imageSmoothingEnabled: true,
    globalAlpha: 1,
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
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
    fillStyleValues,
    strokeStyleValues,
  };

  Object.defineProperties(ctx, {
    fillStyle: {
      configurable: true,
      get: () => fillStyle,
      set: (value: string) => {
        fillStyle = value;
        fillStyleValues.push(value);
      },
    },
    strokeStyle: {
      configurable: true,
      get: () => strokeStyle,
      set: (value: string) => {
        strokeStyle = value;
        strokeStyleValues.push(value);
      },
    },
  });

  return ctx;
};

afterEach(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: originalGetContext,
  });
  restoreWindowProperty("devicePixelRatio", originalDevicePixelRatio);
  restoreWindowProperty("matchMedia", originalMatchMedia);
  restoreWindowProperty("requestAnimationFrame", originalRequestAnimationFrame);
  restoreWindowProperty("cancelAnimationFrame", originalCancelAnimationFrame);
  vi.restoreAllMocks();
});

describe("AgentGlyph", () => {
  it("renders a high-DPI canvas scaled by graphScale", () => {
    const ctx = createContextStub();
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: () => ctx,
    });
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 3,
    });

    const { getByTestId } = render(
      <AgentGlyph animation="idle" graphScale={2} size={80} testId="agent-glyph" />,
    );

    const canvas = getByTestId("agent-glyph") as HTMLCanvasElement;
    expect(canvas.width).toBe(320);
    expect(canvas.height).toBe(320);
    expect(canvas.style.width).toBe("80px");
    expect(canvas.style.height).toBe("80px");
    expect(ctx.setTransform).toHaveBeenCalledWith(4, 0, 0, 4, 0, 0);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 80, 80);
  });

  it("does not schedule animation frames when reduced motion is requested", () => {
    const ctx = createContextStub();
    const requestAnimationFrame = vi.fn();
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: () => ctx,
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      value: requestAnimationFrame,
    });

    render(<AgentGlyph animation="pulse" size={96} />);

    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);
  });
});

describe("MascotSprite", () => {
  it("maps legacy mascot props to AgentGlyph drawing behavior", () => {
    const ctx = createContextStub();
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: () => ctx,
    });

    render(
      <MascotSprite
        animation="swim-up"
        expression="happy"
        accessory="long"
        density="minimal"
        hairColor="#00ccff"
        color="#ff00aa"
        identitySeed="legacy"
        size={160}
      />,
    );

    expect(ctx.translate).toHaveBeenCalledWith(80, 77.8);
    expect(ctx.ellipse.mock.calls).toEqual(
      expect.arrayContaining([
        expect.arrayContaining([0, 22, 35, 4.6000000000000005, 0, 0, Math.PI * 2]),
        expect.arrayContaining([0, -5.5, 43, 27, 0, 0, Math.PI * 2]),
      ]),
    );
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.fillStyleValues).toContain("#ff00aa");
    expect(ctx.fillStyleValues).toContain("#00ccff");
  });
});
