import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useCanvasTransform } from "../src/app/hooks/useCanvasTransform";

const mountSvg = (result: { current: ReturnType<typeof useCanvasTransform> }) => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

  // SAFETY: fitAll only reads width and height from the rect it receives.
  svg.getBoundingClientRect = () =>
    ({
      bottom: 600,
      height: 600,
      left: 0,
      right: 1000,
      top: 0,
      width: 1000,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;

  Object.defineProperty(result.current.svgRef, "current", { value: svg, writable: true });
};

describe("useCanvasTransform fitAll", () => {
  it("does not zoom a single mascot node past a readable size", () => {
    const { result } = renderHook(() => useCanvasTransform());

    mountSvg(result);

    act(() => {
      result.current.fitAll([{ radius: 52, x: 0, y: 0 }]);
    });

    expect(result.current.transform.scale).toBe(1);
  });

  it("includes node radii when sizing the fitted graph", () => {
    const { result } = renderHook(() => useCanvasTransform());

    mountSvg(result);

    act(() => {
      result.current.fitAll([
        { radius: 52, x: -1000, y: 0 },
        { radius: 52, x: 1000, y: 0 },
      ]);
    });

    expect(result.current.transform.scale).toBeCloseTo(600 / 2104, 3);
  });
});
