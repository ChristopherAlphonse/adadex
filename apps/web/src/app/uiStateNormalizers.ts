import { asRecord, isBoolean, isNumber, isString, type ParsedValue } from "@adadex/core";

import { isPrimaryNavIndex, MAX_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH } from "./constants";
import { isTerminalCompletionSoundId } from "./notificationSounds";
import type { FrontendUiStateSnapshot } from "./types";

export const clampSidebarWidth = (width: number) =>
  Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));

export const normalizeFrontendUiStateSnapshot = (
  value: ParsedValue,
): FrontendUiStateSnapshot | null => {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  const nextState: FrontendUiStateSnapshot = {};

  if (
    isNumber(record.activePrimaryNav) &&
    Number.isInteger(record.activePrimaryNav) &&
    isPrimaryNavIndex(record.activePrimaryNav)
  ) {
    nextState.activePrimaryNav = record.activePrimaryNav;
  }

  if (isBoolean(record.isAgentsSidebarVisible)) {
    nextState.isAgentsSidebarVisible = record.isAgentsSidebarVisible;
  }

  if (isNumber(record.sidebarWidth) && Number.isFinite(record.sidebarWidth)) {
    nextState.sidebarWidth = clampSidebarWidth(record.sidebarWidth);
  }

  if (isBoolean(record.isActiveAgentsSectionExpanded)) {
    nextState.isActiveAgentsSectionExpanded = record.isActiveAgentsSectionExpanded;
  }

  if (isBoolean(record.isRuntimeStatusStripVisible)) {
    nextState.isRuntimeStatusStripVisible = record.isRuntimeStatusStripVisible;
  }

  const completionSoundValue = record.terminalCompletionSound;

  if (isTerminalCompletionSoundId(completionSoundValue)) {
    nextState.terminalCompletionSound = completionSoundValue;
  }

  const minimizedIdsValue = record.minimizedTerminalIds;

  if (Array.isArray(minimizedIdsValue)) {
    nextState.minimizedTerminalIds = [...new Set(minimizedIdsValue)].filter((id): id is string =>
      isString(id),
    );
  }

  const rawTerminalWidths = asRecord(record.terminalWidths);

  if (rawTerminalWidths) {
    nextState.terminalWidths = Object.entries(rawTerminalWidths).reduce<Record<string, number>>(
      (acc, [terminalId, width]) => {
        if (isNumber(width) && Number.isFinite(width)) {
          acc[terminalId] = width;
        }

        return acc;
      },
      {},
    );
  }

  if (Array.isArray(record.canvasOpenTerminalIds)) {
    nextState.canvasOpenTerminalIds = record.canvasOpenTerminalIds.filter((id): id is string =>
      isString(id),
    );
  }

  if (Array.isArray(record.canvasOpenCoordinationIds)) {
    nextState.canvasOpenCoordinationIds = record.canvasOpenCoordinationIds.filter(
      (id): id is string => isString(id),
    );
  }

  if (
    isNumber(record.canvasTerminalsPanelWidth) &&
    Number.isFinite(record.canvasTerminalsPanelWidth)
  ) {
    nextState.canvasTerminalsPanelWidth = record.canvasTerminalsPanelWidth;
  }

  return nextState;
};
