import { useCallback, useEffect, useRef, useState } from "react";
import { buildUiStateUrl } from "../../runtime/runtimeEndpoints";
import { MIN_SIDEBAR_WIDTH, UI_STATE_SAVE_DEBOUNCE_MS, isPrimaryNavIndex } from "../constants";
import { DEFAULT_TERMINAL_COMPLETION_SOUND, isTerminalCompletionSoundId, } from "../notificationSounds";
import { retainActiveTerminalEntries, retainActiveTerminalIds } from "../terminalState";
import { clampSidebarWidth, normalizeFrontendUiStateSnapshot } from "../uiStateNormalizers";
const DEFAULT_ACTIVE_PRIMARY_NAV = 1;
const DEFAULT_IS_AGENTS_SIDEBAR_VISIBLE = true;
const DEFAULT_IS_ACTIVE_AGENTS_SECTION_EXPANDED = true;
const DEFAULT_IS_RUNTIME_STATUS_STRIP_VISIBLE = true;
const DEFAULT_IS_CODEX_USAGE_VISIBLE = true;
const DEFAULT_IS_CODEX_USAGE_SECTION_EXPANDED = true;
const DEFAULT_MINIMIZED_TERMINAL_IDS = [];
const DEFAULT_TERMINAL_WIDTHS = {};
const DEFAULT_CANVAS_OPEN_TERMINAL_IDS = [];
const DEFAULT_CANVAS_OPEN_COORDINATION_IDS = [];
const TERMINAL_COMPLETION_SOUND_STORAGE_KEY = "adadex.terminalCompletionSound";
const readLocalTerminalCompletionSound = () => {
    if (typeof window === "undefined") {
        return null;
    }
    try {
        const value = window.localStorage.getItem(TERMINAL_COMPLETION_SOUND_STORAGE_KEY);
        return isTerminalCompletionSoundId(value) ? value : null;
    }
    catch {
        return null;
    }
};
const writeLocalTerminalCompletionSound = (soundId) => {
    try {
        window.localStorage.setItem(TERMINAL_COMPLETION_SOUND_STORAGE_KEY, soundId);
    }
    catch {
        // Browser storage can be disabled; workspace persistence still handles the setting.
    }
};
const areStringArraysEqual = (left, right) => {
    if (left === right) {
        return true;
    }
    const nextLeft = left ?? [];
    const nextRight = right ?? [];
    if (nextLeft.length !== nextRight.length) {
        return false;
    }
    return nextLeft.every((value, index) => value === nextRight[index]);
};
const areNumberRecordMapsEqual = (left, right) => {
    if (left === right) {
        return true;
    }
    const leftEntries = Object.entries(left ?? {});
    const rightEntries = right ?? {};
    if (leftEntries.length !== Object.keys(rightEntries).length) {
        return false;
    }
    return leftEntries.every(([key, value]) => rightEntries[key] === value);
};
const buildPersistedUiStateSnapshot = ({ activePrimaryNav, isAgentsSidebarVisible, sidebarWidth, isActiveAgentsSectionExpanded, isRuntimeStatusStripVisible, isCodexUsageVisible, isCodexUsageSectionExpanded, terminalCompletionSound, minimizedTerminalIds, terminalWidths, canvasOpenTerminalIds, canvasOpenCoordinationIds, canvasTerminalsPanelWidth, }) => ({
    activePrimaryNav,
    isAgentsSidebarVisible,
    sidebarWidth: clampSidebarWidth(sidebarWidth),
    isActiveAgentsSectionExpanded,
    isRuntimeStatusStripVisible,
    isCodexUsageVisible,
    isCodexUsageSectionExpanded,
    terminalCompletionSound,
    minimizedTerminalIds,
    terminalWidths,
    canvasOpenTerminalIds,
    canvasOpenCoordinationIds,
    ...(canvasTerminalsPanelWidth != null ? { canvasTerminalsPanelWidth } : {}),
});
const areUiStateSnapshotsEqual = (left, right) => left !== null &&
    left.activePrimaryNav === right.activePrimaryNav &&
    left.isAgentsSidebarVisible === right.isAgentsSidebarVisible &&
    left.sidebarWidth === right.sidebarWidth &&
    left.isActiveAgentsSectionExpanded === right.isActiveAgentsSectionExpanded &&
    left.isRuntimeStatusStripVisible === right.isRuntimeStatusStripVisible &&
    left.isCodexUsageVisible === right.isCodexUsageVisible &&
    left.isCodexUsageSectionExpanded === right.isCodexUsageSectionExpanded &&
    left.terminalCompletionSound === right.terminalCompletionSound &&
    areStringArraysEqual(left.minimizedTerminalIds, right.minimizedTerminalIds) &&
    areNumberRecordMapsEqual(left.terminalWidths, right.terminalWidths) &&
    areStringArraysEqual(left.canvasOpenTerminalIds, right.canvasOpenTerminalIds) &&
    areStringArraysEqual(left.canvasOpenCoordinationIds, right.canvasOpenCoordinationIds) &&
    left.canvasTerminalsPanelWidth === right.canvasTerminalsPanelWidth;
export const usePersistedUiState = ({ columns, }) => {
    const [activePrimaryNav, setActivePrimaryNav] = useState(DEFAULT_ACTIVE_PRIMARY_NAV);
    const [isAgentsSidebarVisible, setIsAgentsSidebarVisible] = useState(DEFAULT_IS_AGENTS_SIDEBAR_VISIBLE);
    const [sidebarWidth, setSidebarWidth] = useState(MIN_SIDEBAR_WIDTH);
    const [isActiveAgentsSectionExpanded, setIsActiveAgentsSectionExpanded] = useState(DEFAULT_IS_ACTIVE_AGENTS_SECTION_EXPANDED);
    const [isRuntimeStatusStripVisible, setIsRuntimeStatusStripVisible] = useState(DEFAULT_IS_RUNTIME_STATUS_STRIP_VISIBLE);
    const [isCodexUsageVisible, setIsCodexUsageVisible] = useState(DEFAULT_IS_CODEX_USAGE_VISIBLE);
    const [isCodexUsageSectionExpanded, setIsCodexUsageSectionExpanded] = useState(DEFAULT_IS_CODEX_USAGE_SECTION_EXPANDED);
    const [terminalCompletionSound, setTerminalCompletionSound] = useState(() => readLocalTerminalCompletionSound() ?? DEFAULT_TERMINAL_COMPLETION_SOUND);
    const [isUiStateHydrated, setIsUiStateHydrated] = useState(false);
    const [hasHydratedUiStateSnapshot, setHasHydratedUiStateSnapshot] = useState(false);
    const [minimizedTerminalIds, setMinimizedTerminalIds] = useState(DEFAULT_MINIMIZED_TERMINAL_IDS);
    const [terminalWidths, setTerminalWidths] = useState(DEFAULT_TERMINAL_WIDTHS);
    const [canvasOpenTerminalIds, setCanvasOpenTerminalIds] = useState(DEFAULT_CANVAS_OPEN_TERMINAL_IDS);
    const [canvasOpenCoordinationIds, setCanvasOpenCoordinationIds] = useState(DEFAULT_CANVAS_OPEN_COORDINATION_IDS);
    const [canvasTerminalsPanelWidth, setCanvasTerminalsPanelWidth] = useState(null);
    const lastPersistedUiStateRef = useRef(null);
    const readUiState = useCallback(async (signal) => {
        try {
            const requestOptions = {
                method: "GET",
                headers: {
                    Accept: "application/json",
                },
            };
            if (signal) {
                requestOptions.signal = signal;
            }
            const response = await fetch(buildUiStateUrl(), requestOptions);
            if (!response.ok) {
                return null;
            }
            return normalizeFrontendUiStateSnapshot(await response.json());
        }
        catch {
            return null;
        }
    }, []);
    const applyHydratedUiState = useCallback((snapshot, nextColumns) => {
        const activeTerminalIds = new Set(nextColumns.map((entry) => entry.terminalId));
        const activeOrchestrationIds = new Set(nextColumns.map((entry) => entry.coordinationId));
        const hasPersistedSnapshot = snapshot !== null && Object.keys(snapshot).length > 0;
        const localTerminalCompletionSound = readLocalTerminalCompletionSound();
        const nextTerminalCompletionSound = localTerminalCompletionSound ??
            snapshot?.terminalCompletionSound ??
            DEFAULT_TERMINAL_COMPLETION_SOUND;
        setHasHydratedUiStateSnapshot(hasPersistedSnapshot);
        if (!snapshot) {
            lastPersistedUiStateRef.current = buildPersistedUiStateSnapshot({
                activePrimaryNav: DEFAULT_ACTIVE_PRIMARY_NAV,
                isAgentsSidebarVisible: DEFAULT_IS_AGENTS_SIDEBAR_VISIBLE,
                sidebarWidth: MIN_SIDEBAR_WIDTH,
                isActiveAgentsSectionExpanded: DEFAULT_IS_ACTIVE_AGENTS_SECTION_EXPANDED,
                isRuntimeStatusStripVisible: DEFAULT_IS_RUNTIME_STATUS_STRIP_VISIBLE,
                isCodexUsageVisible: DEFAULT_IS_CODEX_USAGE_VISIBLE,
                isCodexUsageSectionExpanded: DEFAULT_IS_CODEX_USAGE_SECTION_EXPANDED,
                terminalCompletionSound: nextTerminalCompletionSound,
                minimizedTerminalIds: DEFAULT_MINIMIZED_TERMINAL_IDS,
                terminalWidths: DEFAULT_TERMINAL_WIDTHS,
                canvasOpenTerminalIds: DEFAULT_CANVAS_OPEN_TERMINAL_IDS,
                canvasOpenCoordinationIds: DEFAULT_CANVAS_OPEN_COORDINATION_IDS,
                canvasTerminalsPanelWidth: null,
            });
            if (localTerminalCompletionSound) {
                setTerminalCompletionSound(localTerminalCompletionSound);
            }
            return;
        }
        const nextMinimizedTerminalIds = snapshot.minimizedTerminalIds
            ? retainActiveTerminalIds(snapshot.minimizedTerminalIds, activeTerminalIds)
            : DEFAULT_MINIMIZED_TERMINAL_IDS;
        const nextTerminalWidths = snapshot.terminalWidths
            ? retainActiveTerminalEntries(snapshot.terminalWidths, activeTerminalIds)
            : DEFAULT_TERMINAL_WIDTHS;
        const nextCanvasOpenTerminalIds = snapshot.canvasOpenTerminalIds
            ? retainActiveTerminalIds(snapshot.canvasOpenTerminalIds, activeTerminalIds)
            : DEFAULT_CANVAS_OPEN_TERMINAL_IDS;
        const nextCanvasOpenCoordinationIds = snapshot.canvasOpenCoordinationIds
            ? retainActiveTerminalIds(snapshot.canvasOpenCoordinationIds, activeOrchestrationIds)
            : DEFAULT_CANVAS_OPEN_COORDINATION_IDS;
        lastPersistedUiStateRef.current = buildPersistedUiStateSnapshot({
            activePrimaryNav: snapshot.activePrimaryNav !== undefined && isPrimaryNavIndex(snapshot.activePrimaryNav)
                ? snapshot.activePrimaryNav
                : DEFAULT_ACTIVE_PRIMARY_NAV,
            isAgentsSidebarVisible: snapshot.isAgentsSidebarVisible ?? DEFAULT_IS_AGENTS_SIDEBAR_VISIBLE,
            sidebarWidth: snapshot.sidebarWidth ?? MIN_SIDEBAR_WIDTH,
            isActiveAgentsSectionExpanded: snapshot.isActiveAgentsSectionExpanded ?? DEFAULT_IS_ACTIVE_AGENTS_SECTION_EXPANDED,
            isRuntimeStatusStripVisible: snapshot.isRuntimeStatusStripVisible ?? DEFAULT_IS_RUNTIME_STATUS_STRIP_VISIBLE,
            isCodexUsageVisible: snapshot.isCodexUsageVisible ?? DEFAULT_IS_CODEX_USAGE_VISIBLE,
            isCodexUsageSectionExpanded: snapshot.isCodexUsageSectionExpanded ?? DEFAULT_IS_CODEX_USAGE_SECTION_EXPANDED,
            terminalCompletionSound: nextTerminalCompletionSound,
            minimizedTerminalIds: nextMinimizedTerminalIds,
            terminalWidths: nextTerminalWidths,
            canvasOpenTerminalIds: nextCanvasOpenTerminalIds,
            canvasOpenCoordinationIds: nextCanvasOpenCoordinationIds,
            canvasTerminalsPanelWidth: snapshot.canvasTerminalsPanelWidth ?? null,
        });
        if (snapshot.activePrimaryNav !== undefined && isPrimaryNavIndex(snapshot.activePrimaryNav)) {
            setActivePrimaryNav(snapshot.activePrimaryNav);
        }
        if (snapshot.isAgentsSidebarVisible !== undefined) {
            setIsAgentsSidebarVisible(snapshot.isAgentsSidebarVisible);
        }
        if (snapshot.sidebarWidth !== undefined) {
            setSidebarWidth(clampSidebarWidth(snapshot.sidebarWidth));
        }
        if (snapshot.isActiveAgentsSectionExpanded !== undefined) {
            setIsActiveAgentsSectionExpanded(snapshot.isActiveAgentsSectionExpanded);
        }
        if (snapshot.isRuntimeStatusStripVisible !== undefined) {
            setIsRuntimeStatusStripVisible(snapshot.isRuntimeStatusStripVisible);
        }
        if (snapshot.isCodexUsageVisible !== undefined) {
            setIsCodexUsageVisible(snapshot.isCodexUsageVisible);
        }
        if (snapshot.isCodexUsageSectionExpanded !== undefined) {
            setIsCodexUsageSectionExpanded(snapshot.isCodexUsageSectionExpanded);
        }
        if (localTerminalCompletionSound || snapshot.terminalCompletionSound !== undefined) {
            setTerminalCompletionSound(nextTerminalCompletionSound);
        }
        if (snapshot.minimizedTerminalIds) {
            setMinimizedTerminalIds(nextMinimizedTerminalIds);
        }
        if (snapshot.terminalWidths) {
            setTerminalWidths(nextTerminalWidths);
        }
        if (snapshot.canvasOpenTerminalIds) {
            setCanvasOpenTerminalIds(nextCanvasOpenTerminalIds);
        }
        if (snapshot.canvasOpenCoordinationIds) {
            setCanvasOpenCoordinationIds(nextCanvasOpenCoordinationIds);
        }
        if (snapshot.canvasTerminalsPanelWidth !== undefined) {
            setCanvasTerminalsPanelWidth(snapshot.canvasTerminalsPanelWidth);
        }
    }, []);
    useEffect(() => {
        const activeTerminalIds = new Set(columns.map((entry) => entry.terminalId));
        const activeOrchestrationIds = new Set(columns.map((entry) => entry.coordinationId));
        setMinimizedTerminalIds((current) => retainActiveTerminalIds(current, activeTerminalIds));
        setTerminalWidths((current) => retainActiveTerminalEntries(current, activeTerminalIds));
        setCanvasOpenTerminalIds((current) => retainActiveTerminalIds(current, activeTerminalIds));
        setCanvasOpenCoordinationIds((current) => retainActiveTerminalIds(current, activeOrchestrationIds));
    }, [columns]);
    useEffect(() => {
        if (!isUiStateHydrated) {
            return;
        }
        writeLocalTerminalCompletionSound(terminalCompletionSound);
    }, [isUiStateHydrated, terminalCompletionSound]);
    useEffect(() => {
        if (!isUiStateHydrated) {
            return;
        }
        const payload = buildPersistedUiStateSnapshot({
            activePrimaryNav,
            isAgentsSidebarVisible,
            sidebarWidth,
            isActiveAgentsSectionExpanded,
            isRuntimeStatusStripVisible,
            isCodexUsageVisible,
            isCodexUsageSectionExpanded,
            terminalCompletionSound,
            minimizedTerminalIds,
            terminalWidths,
            canvasOpenTerminalIds,
            canvasOpenCoordinationIds,
            canvasTerminalsPanelWidth,
        });
        if (areUiStateSnapshotsEqual(lastPersistedUiStateRef.current, payload)) {
            return;
        }
        const timerId = window.setTimeout(() => {
            void fetch(buildUiStateUrl(), {
                method: "PATCH",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            })
                .then((response) => {
                if (!response.ok) {
                    throw new Error(`Unexpected status ${response.status}`);
                }
                lastPersistedUiStateRef.current = payload;
            })
                .catch((error) => {
                console.warn("[ui-state] Failed to persist UI state:", error);
            });
        }, UI_STATE_SAVE_DEBOUNCE_MS);
        return () => {
            window.clearTimeout(timerId);
        };
    }, [
        activePrimaryNav,
        canvasOpenTerminalIds,
        canvasOpenCoordinationIds,
        canvasTerminalsPanelWidth,
        isActiveAgentsSectionExpanded,
        isAgentsSidebarVisible,
        isRuntimeStatusStripVisible,
        isCodexUsageVisible,
        isCodexUsageSectionExpanded,
        isUiStateHydrated,
        minimizedTerminalIds,
        sidebarWidth,
        terminalCompletionSound,
        terminalWidths,
    ]);
    return {
        activePrimaryNav,
        setActivePrimaryNav,
        isUiStateHydrated,
        setIsUiStateHydrated,
        hasHydratedUiStateSnapshot,
        isAgentsSidebarVisible,
        setIsAgentsSidebarVisible,
        sidebarWidth,
        setSidebarWidth,
        isActiveAgentsSectionExpanded,
        setIsActiveAgentsSectionExpanded,
        isRuntimeStatusStripVisible,
        setIsRuntimeStatusStripVisible,
        isCodexUsageVisible,
        setIsCodexUsageVisible,
        isCodexUsageSectionExpanded,
        setIsCodexUsageSectionExpanded,
        terminalCompletionSound,
        setTerminalCompletionSound,
        minimizedTerminalIds,
        setMinimizedTerminalIds,
        terminalWidths,
        setTerminalWidths,
        canvasOpenTerminalIds,
        setCanvasOpenTerminalIds,
        canvasOpenCoordinationIds,
        setCanvasOpenCoordinationIds,
        canvasTerminalsPanelWidth,
        setCanvasTerminalsPanelWidth,
        readUiState,
        applyHydratedUiState,
    };
};
