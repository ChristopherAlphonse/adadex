import type { ChannelMessage } from "./types";

const MAX_REPORT_CHARS = 4000;

const RECENT_REPORT_MS = 120_000;

/** What the parent agent reads when a child agent ends its turn. */
export const buildThreadReport = (childLabel: string, finalMessage: string): string => {
  const trimmed = finalMessage.trim();

  const body =
    trimmed.length > MAX_REPORT_CHARS ? `${trimmed.slice(0, MAX_REPORT_CHARS)}…` : trimmed;

  return `Thread report: "${childLabel}" finished its turn. Its final message: ${body}`;
};

/** True when the child already sent the parent a message a moment ago, so a second report would only repeat it. */
export const hasRecentReportFrom = (
  parentQueue: readonly ChannelMessage[],
  childTerminalId: string,
  now: number,
): boolean =>
  parentQueue.some(
    (message) =>
      message.fromTerminalId === childTerminalId &&
      now - Date.parse(message.timestamp) < RECENT_REPORT_MS,
  );
