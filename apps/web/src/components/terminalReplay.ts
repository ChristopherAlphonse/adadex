import { isFunctionValue, isNumber } from "@adadex/core";

type ReplayViewport = Pick<HTMLElement, "clientHeight" | "scrollHeight" | "scrollTop">;

type ReplayTerminal = {
  reset: () => void;
  write: (value: string, callback?: () => void) => void;
  clearSelection?: () => void;
  refresh?: (start: number, end: number) => void;
  rows?: number;
};

const NEAR_BOTTOM_THRESHOLD_PX = 8;

/** Mouse tracking modes (X10, normal, button, any-event, UTF-8, SGR, urxvt) an app can switch on. */
// oxlint-disable-next-line no-control-regex -- ESC is the point of this pattern
const MOUSE_TRACKING_ENABLE = /\u001b\[\?(?:\d+;)*(?:9|100[0-6]|1015)(?:;\d+)*h/g;

/**
 * Saved history can contain the sequence that turned mouse tracking on without the one that turned it off, because
 * the app that asked for it has since exited. Replaying that would leave the terminal reporting every mouse move to
 * whatever is running now, which a plain shell prints as `35;33;2M` junk.
 */
export const stripMouseTracking = (history: string): string =>
  history.replace(MOUSE_TRACKING_ENABLE, "");

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
  terminal.write(stripMouseTracking(history), () => {
    terminal.clearSelection?.();

    if (isFunctionValue(terminal.refresh) && isNumber(terminal.rows) && terminal.rows > 0) {
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
