type ReplayViewport = Pick<HTMLElement, "clientHeight" | "scrollHeight" | "scrollTop">;

type ReplayTerminal = {
  reset: () => void;
  write: (value: string, callback?: () => void) => void;
  clearSelection?: () => void;
  refresh?: (start: number, end: number) => void;
  rows?: number;
};

const NEAR_BOTTOM_THRESHOLD_PX = 8;

const restoreViewportScroll = (
  viewport: ReplayViewport,
  previousScrollTop: number,
  wasNearBottom: boolean,
) => {
  if (wasNearBottom) {
    viewport.scrollTop = viewport.scrollHeight;
    return;
  }

  viewport.scrollTop = Math.max(
    0,
    Math.min(previousScrollTop, viewport.scrollHeight - viewport.clientHeight),
  );
};

export const replayTerminalHistory = (
  terminal: ReplayTerminal,
  history: string,
  viewport: ReplayViewport | null,
) => {
  const previousScrollTop = viewport?.scrollTop ?? 0;
  const wasNearBottom =
    viewport !== null
      ? viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <=
        NEAR_BOTTOM_THRESHOLD_PX
      : false;

  terminal.clearSelection?.();
  terminal.reset();
  terminal.write(history, () => {
    terminal.clearSelection?.();

    if (
      typeof terminal.refresh === "function" &&
      typeof terminal.rows === "number" &&
      terminal.rows > 0
    ) {
      terminal.refresh(0, terminal.rows - 1);
    }

    if (!viewport) {
      return;
    }

    window.requestAnimationFrame(() => {
      restoreViewportScroll(viewport, previousScrollTop, wasNearBottom);
    });
  });
};
