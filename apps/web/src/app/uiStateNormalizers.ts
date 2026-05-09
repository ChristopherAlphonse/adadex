import { asRecord } from "@adadex/core";

import { MAX_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH, PRIMARY_NAV_MAX } from "./constants";
import { isTerminalCompletionSoundId } from "./notificationSounds";
import type { FrontendUiStateSnapshot } from "./types";

export const clampSidebarWidth = (width: number) =>
  Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));

export const normalizeFrontendUiStateSnapshot = (
  value: unknown,
): FrontendUiStateSnapshot | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const nextState: FrontendUiStateSnapshot = {};
  if (
    typeof record.activePrimaryNav === "number" &&
    Number.isInteger(record.activePrimaryNav) &&
    record.activePrimaryNav >= 1 &&
    record.activePrimaryNav <= PRIMARY_NAV_MAX
  ) {
    nextState.activePrimaryNav = record.activePrimaryNav;
  }

  if (typeof record.isAgentsSidebarVisible === "boolean") {
    nextState.isAgentsSidebarVisible = record.isAgentsSidebarVisible;
  }

  if (typeof record.sidebarWidth === "number" && Number.isFinite(record.sidebarWidth)) {
    nextState.sidebarWidth = clampSidebarWidth(record.sidebarWidth);
  }

  if (typeof record.isActiveAgentsSectionExpanded === "boolean") {
    nextState.isActiveAgentsSectionExpanded = record.isActiveAgentsSectionExpanded;
  }

  if (typeof record.isRuntimeStatusStripVisible === "boolean") {
    nextState.isRuntimeStatusStripVisible = record.isRuntimeStatusStripVisible;
  }

  if (typeof record.isMonitorVisible === "boolean") {
    nextState.isMonitorVisible = record.isMonitorVisible;
  }

  if (typeof record.isCodexUsageVisible === "boolean") {
    nextState.isCodexUsageVisible = record.isCodexUsageVisible;
  }

  if (typeof record.isCodexUsageSectionExpanded === "boolean") {
    nextState.isCodexUsageSectionExpanded = record.isCodexUsageSectionExpanded;
  }

  const completionSoundValue = record.terminalCompletionSound;
  if (isTerminalCompletionSoundId(completionSoundValue)) {
    nextState.terminalCompletionSound = completionSoundValue;
  }

  const minimizedIdsValue = record.minimizedTerminalIds;
  if (Array.isArray(minimizedIdsValue)) {
    nextState.minimizedTerminalIds = [...new Set(minimizedIdsValue)].filter(
      (id): id is string => typeof id === "string",
    );
  }

  const rawTerminalWidths = asRecord(record.terminalWidths);
  if (rawTerminalWidths) {
    nextState.terminalWidths = Object.entries(rawTerminalWidths).reduce<Record<string, number>>(
      (acc, [terminalId, width]) => {
        if (typeof width === "number" && Number.isFinite(width)) {
          acc[terminalId] = width;
        }
        return acc;
      },
      {},
    );
  }

  if (Array.isArray(record.canvasOpenTerminalIds)) {
    nextState.canvasOpenTerminalIds = record.canvasOpenTerminalIds.filter(
      (id): id is string => typeof id === "string",
    );
  }

  if (Array.isArray(record.canvasOpenCoordinationIds)) {
    nextState.canvasOpenCoordinationIds = record.canvasOpenCoordinationIds.filter(
      (id): id is string => typeof id === "string",
    );
  }

  if (
    typeof record.canvasTerminalsPanelWidth === "number" &&
    Number.isFinite(record.canvasTerminalsPanelWidth)
  ) {
    nextState.canvasTerminalsPanelWidth = record.canvasTerminalsPanelWidth;
  }

  return nextState;
};
