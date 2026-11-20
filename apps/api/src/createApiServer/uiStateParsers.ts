import {
  isBoolean,
  isNumber,
  isObjectValue,
  isString,
  type ParsedRecord,
} from "@adadex/core";
import { isTerminalCompletionSoundId, type PersistedUiState } from "../terminalRuntime";
import type { JsonRequestPayload } from "./requestParsers";

type UiStatePatchParseResult = { patch: PersistedUiState | null; error: string | null };

export const parseUiStatePatch = (payload: JsonRequestPayload): UiStatePatchParseResult => {
  if (payload === null || payload === undefined || !isObjectValue(payload)) {
    return {
      patch: null,
      error: "Expected a JSON object body.",
    };
  }

  // SAFETY: the parse boundary produced ParsedValue members; missing keys read as undefined.
  const record = payload as ParsedRecord;
  const patch: PersistedUiState = {};

  if (record.activePrimaryNav !== undefined) {
    if (
      !isNumber(record.activePrimaryNav) ||
      !Number.isInteger(record.activePrimaryNav) ||
      record.activePrimaryNav < 1
    ) {
      return {
        patch: null,
        error: "activePrimaryNav must be a positive integer.",
      };
    }

    patch.activePrimaryNav = record.activePrimaryNav;
  }

  if (record.isAgentsSidebarVisible !== undefined) {
    if (!isBoolean(record.isAgentsSidebarVisible)) {
      return {
        patch: null,
        error: "isAgentsSidebarVisible must be a boolean.",
      };
    }

    patch.isAgentsSidebarVisible = record.isAgentsSidebarVisible;
  }

  if (record.sidebarWidth !== undefined) {
    if (!isNumber(record.sidebarWidth) || !Number.isFinite(record.sidebarWidth)) {
      return {
        patch: null,
        error: "sidebarWidth must be a finite number.",
      };
    }

    patch.sidebarWidth = record.sidebarWidth;
  }

  if (record.isActiveAgentsSectionExpanded !== undefined) {
    if (!isBoolean(record.isActiveAgentsSectionExpanded)) {
      return {
        patch: null,
        error: "isActiveAgentsSectionExpanded must be a boolean.",
      };
    }

    patch.isActiveAgentsSectionExpanded = record.isActiveAgentsSectionExpanded;
  }

  if (record.isRuntimeStatusStripVisible !== undefined) {
    if (!isBoolean(record.isRuntimeStatusStripVisible)) {
      return {
        patch: null,
        error: "isRuntimeStatusStripVisible must be a boolean.",
      };
    }

    patch.isRuntimeStatusStripVisible = record.isRuntimeStatusStripVisible;
  }

  const completionSoundKey = record.terminalCompletionSound;

  if (completionSoundKey !== undefined) {
    if (!isTerminalCompletionSoundId(completionSoundKey)) {
      return {
        patch: null,
        error: "terminalCompletionSound must be one of the supported sound identifiers.",
      };
    }

    patch.terminalCompletionSound = completionSoundKey;
  }

  const minimizedKey = record.minimizedTerminalIds;

  if (minimizedKey !== undefined) {
    if (!Array.isArray(minimizedKey)) {
      return {
        patch: null,
        error: "minimizedTerminalIds must be an array of strings.",
      };
    }

    const minimizedTerminalIds = minimizedKey.filter((id): id is string => isString(id));

    if (minimizedTerminalIds.length !== minimizedKey.length) {
      return {
        patch: null,
        error: "minimizedTerminalIds must be an array of strings.",
      };
    }

    patch.minimizedTerminalIds = [...new Set(minimizedTerminalIds)];
  }

  const widthsKey = record.terminalWidths;

  if (widthsKey !== undefined) {
    if (widthsKey === null || !isObjectValue(widthsKey) || Array.isArray(widthsKey)) {
      return {
        patch: null,
        error: "terminalWidths must be an object map of numbers.",
      };
    }

    const terminalWidths = Object.entries(widthsKey).reduce<Record<string, number>>(
      (acc, [id, width]) => {
        if (isNumber(width) && Number.isFinite(width)) {
          acc[id] = width;
        }

        return acc;
      },
      {},
    );

    if (Object.keys(terminalWidths).length !== Object.keys(widthsKey).length) {
      return {
        patch: null,
        error: "terminalWidths must be an object map of numbers.",
      };
    }

    patch.terminalWidths = terminalWidths;
  }

  if (record.canvasOpenTerminalIds !== undefined) {
    if (!Array.isArray(record.canvasOpenTerminalIds)) {
      return {
        patch: null,
        error: "canvasOpenTerminalIds must be an array of strings.",
      };
    }

    const canvasOpenTerminalIds = record.canvasOpenTerminalIds.filter(
      (id): id is string => isString(id),
    );

    if (canvasOpenTerminalIds.length !== record.canvasOpenTerminalIds.length) {
      return {
        patch: null,
        error: "canvasOpenTerminalIds must be an array of strings.",
      };
    }

    patch.canvasOpenTerminalIds = canvasOpenTerminalIds;
  }

  if (record.canvasOpenCoordinationIds !== undefined) {
    if (!Array.isArray(record.canvasOpenCoordinationIds)) {
      return {
        patch: null,
        error: "canvasOpenCoordinationIds must be an array of strings.",
      };
    }

    const canvasOpenCoordinationIds = record.canvasOpenCoordinationIds.filter(
      (id): id is string => isString(id),
    );

    if (canvasOpenCoordinationIds.length !== record.canvasOpenCoordinationIds.length) {
      return {
        patch: null,
        error: "canvasOpenCoordinationIds must be an array of strings.",
      };
    }

    patch.canvasOpenCoordinationIds = canvasOpenCoordinationIds;
  }

  if (record.canvasTerminalsPanelWidth !== undefined) {
    if (
      !isNumber(record.canvasTerminalsPanelWidth) ||
      !Number.isFinite(record.canvasTerminalsPanelWidth)
    ) {
      return {
        patch: null,
        error: "canvasTerminalsPanelWidth must be a finite number.",
      };
    }

    patch.canvasTerminalsPanelWidth = record.canvasTerminalsPanelWidth;
  }

  if (record.terminalInactivityThresholdMs !== undefined) {
    if (
      !isNumber(record.terminalInactivityThresholdMs) ||
      !Number.isFinite(record.terminalInactivityThresholdMs) ||
      record.terminalInactivityThresholdMs <= 0
    ) {
      return {
        patch: null,
        error: "terminalInactivityThresholdMs must be a positive number.",
      };
    }

    patch.terminalInactivityThresholdMs = record.terminalInactivityThresholdMs;
  }

  return { patch, error: null };
};
