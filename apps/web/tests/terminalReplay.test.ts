import { describe, expect, it, vi } from "vitest";

import { replayTerminalHistory } from "../src/components/terminalReplay";

describe("replayTerminalHistory", () => {
  it("clears selection and restores the previous scroll position after replay", () => {
    const reset = vi.fn();
    const clearSelection = vi.fn();
    const refresh = vi.fn();
    const terminal = {
      reset,
      clearSelection,
      refresh,
      rows: 24,
      write: vi.fn((_: string, callback?: () => void) => {
        callback?.();
      }),
    };
    const viewport = {
      clientHeight: 120,
      scrollHeight: 1_400,
      scrollTop: 360,
    };
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });

    replayTerminalHistory(terminal, "history payload", viewport);

    expect(clearSelection).toHaveBeenCalledTimes(2);
    expect(reset).toHaveBeenCalledTimes(1);
    expect(terminal.write).toHaveBeenCalledWith("history payload", expect.any(Function));
    expect(refresh).toHaveBeenCalledWith(0, 23);
    expect(viewport.scrollTop).toBe(360);

    requestAnimationFrameSpy.mockRestore();
  });

  it("pins the viewport to the bottom when it was already near the bottom", () => {
    const terminal = {
      reset: vi.fn(),
      clearSelection: vi.fn(),
      refresh: vi.fn(),
      rows: 30,
      write: vi.fn((_: string, callback?: () => void) => {
        callback?.();
      }),
    };
    const viewport = {
      clientHeight: 300,
      scrollHeight: 910,
      scrollTop: 604,
    };
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        viewport.scrollHeight = 1_280;
        callback(0);
        return 1;
      });

    replayTerminalHistory(terminal, "history payload", viewport);

    expect(viewport.scrollTop).toBe(1_280);

    requestAnimationFrameSpy.mockRestore();
  });
});
