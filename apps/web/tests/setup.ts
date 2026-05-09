import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import { MockWebSocket } from "./test-utils/appTestHarness";

afterEach(() => {
  cleanup();
});

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const canvasContextStub = {
  imageSmoothingEnabled: true,
  globalAlpha: 1,
  fillStyle: "",
  strokeStyle: "",
  lineWidth: 1,
  lineCap: "butt",
  lineJoin: "miter",
  clearRect() {},
  fillRect() {},
  save() {},
  restore() {},
  translate() {},
  rotate() {},
  setTransform() {},
  beginPath() {},
  moveTo() {},
  quadraticCurveTo() {},
  lineTo() {},
  closePath() {},
  stroke() {},
  fill() {},
  ellipse() {},
  arc() {},
};

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  configurable: true,
  value: () => canvasContextStub,
});

globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
