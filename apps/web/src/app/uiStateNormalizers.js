import { asRecord } from "@adadex/core";
import { MAX_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH, isPrimaryNavIndex } from "./constants";
import { isTerminalCompletionSoundId } from "./notificationSounds";
export const clampSidebarWidth = (width) => Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));
export const normalizeFrontendUiStateSnapshot = (value) => {
    const record = asRecord(value);
    if (!record) {
        return null;
    }
    const nextState = {};
    if (typeof record.activePrimaryNav === "number" &&
        Number.isInteger(record.activePrimaryNav) &&
        isPrimaryNavIndex(record.activePrimaryNav)) {
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
        nextState.minimizedTerminalIds = [...new Set(minimizedIdsValue)].filter((id) => typeof id === "string");
    }
    const rawTerminalWidths = asRecord(record.terminalWidths);
    if (rawTerminalWidths) {
        nextState.terminalWidths = Object.entries(rawTerminalWidths).reduce((acc, [terminalId, width]) => {
            if (typeof width === "number" && Number.isFinite(width)) {
                acc[terminalId] = width;
            }
            return acc;
        }, {});
    }
    if (Array.isArray(record.canvasOpenTerminalIds)) {
        nextState.canvasOpenTerminalIds = record.canvasOpenTerminalIds.filter((id) => typeof id === "string");
    }
    if (Array.isArray(record.canvasOpenCoordinationIds)) {
        nextState.canvasOpenCoordinationIds = record.canvasOpenCoordinationIds.filter((id) => typeof id === "string");
    }
    if (typeof record.canvasTerminalsPanelWidth === "number" &&
        Number.isFinite(record.canvasTerminalsPanelWidth)) {
        nextState.canvasTerminalsPanelWidth = record.canvasTerminalsPanelWidth;
    }
    return nextState;
};
