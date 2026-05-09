import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { buildUiStateUrl } from "../../runtime/runtimeEndpoints";
import type { PrimaryNavIndex } from "../constants";
import { MIN_SIDEBAR_WIDTH, PRIMARY_NAV_ITEMS, UI_STATE_SAVE_DEBOUNCE_MS } from "../constants";
import {
  DEFAULT_TERMINAL_COMPLETION_SOUND,
  type TerminalCompletionSoundId,
} from "../notificationSounds";
import { retainActiveTerminalEntries, retainActiveTerminalIds } from "../terminalState";
import type { FrontendUiStateSnapshot, TerminalView } from "../types";
import { clampSidebarWidth, normalizeFrontendUiStateSnapshot } from "../uiStateNormalizers";

type UsePersistedUiStateOptions = {
  columns: TerminalView;
};

const DEFAULT_ACTIVE_PRIMARY_NAV: PrimaryNavIndex = 1;
const DEFAULT_IS_AGENTS_SIDEBAR_VISIBLE = true;
const DEFAULT_IS_ACTIVE_AGENTS_SECTION_EXPANDED = true;
const DEFAULT_IS_RUNTIME_STATUS_STRIP_VISIBLE = true;
const DEFAULT_IS_MONITOR_VISIBLE = true;
const DEFAULT_IS_BOTTOM_TELEMETRY_VISIBLE = true;
const DEFAULT_IS_CODEX_USAGE_VISIBLE = true;
const DEFAULT_IS_CODEX_USAGE_SECTION_EXPANDED = true;
const DEFAULT_MINIMIZED_TERMINAL_IDS: string[] = [];
const DEFAULT_TERMINAL_WIDTHS: Record<string, number> = {};
const DEFAULT_CANVAS_OPEN_TERMINAL_IDS: string[] = [];
const DEFAULT_CANVAS_OPEN_COORDINATION_IDS: string[] = [];

const areStringArraysEqual = (left: string[] | undefined, right: string[] | undefined) => {
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

const areNumberRecordMapsEqual = (
  left: Record<string, number> | undefined,
  right: Record<string, number> | undefined,
) => {
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

const buildPersistedUiStateSnapshot = ({
  activePrimaryNav,
  isAgentsSidebarVisible,
  sidebarWidth,
  isActiveAgentsSectionExpanded,
  isRuntimeStatusStripVisible,
  isMonitorVisible,
  isBottomTelemetryVisible,
  isCodexUsageVisible,
  isCodexUsageSectionExpanded,
  terminalCompletionSound,
  minimizedTerminalIds,
  terminalWidths,
  canvasOpenTerminalIds,
  canvasOpenCoordinationIds,
  canvasTerminalsPanelWidth,
}: {
  activePrimaryNav: PrimaryNavIndex;
  isAgentsSidebarVisible: boolean;
  sidebarWidth: number;
  isActiveAgentsSectionExpanded: boolean;
  isRuntimeStatusStripVisible: boolean;
  isMonitorVisible: boolean;
  isBottomTelemetryVisible: boolean;
  isCodexUsageVisible: boolean;
  isCodexUsageSectionExpanded: boolean;
  terminalCompletionSound: TerminalCompletionSoundId;
  minimizedTerminalIds: string[];
  terminalWidths: Record<string, number>;
  canvasOpenTerminalIds: string[];
  canvasOpenCoordinationIds: string[];
  canvasTerminalsPanelWidth: number | null;
}): FrontendUiStateSnapshot => ({
  activePrimaryNav,
  isAgentsSidebarVisible,
  sidebarWidth: clampSidebarWidth(sidebarWidth),
  isActiveAgentsSectionExpanded,
  isRuntimeStatusStripVisible,
  isMonitorVisible,
  isBottomTelemetryVisible,
  isCodexUsageVisible,
  isCodexUsageSectionExpanded,
  terminalCompletionSound,
  minimizedTerminalIds,
  terminalWidths,
  canvasOpenTerminalIds,
  canvasOpenCoordinationIds,
  ...(canvasTerminalsPanelWidth != null ? { canvasTerminalsPanelWidth } : {}),
});

const areUiStateSnapshotsEqual = (
  left: FrontendUiStateSnapshot | null,
  right: FrontendUiStateSnapshot,
) =>
  left !== null &&
  left.activePrimaryNav === right.activePrimaryNav &&
  left.isAgentsSidebarVisible === right.isAgentsSidebarVisible &&
  left.sidebarWidth === right.sidebarWidth &&
  left.isActiveAgentsSectionExpanded === right.isActiveAgentsSectionExpanded &&
  left.isRuntimeStatusStripVisible === right.isRuntimeStatusStripVisible &&
  left.isMonitorVisible === right.isMonitorVisible &&
  left.isBottomTelemetryVisible === right.isBottomTelemetryVisible &&
  left.isCodexUsageVisible === right.isCodexUsageVisible &&
  left.isCodexUsageSectionExpanded === right.isCodexUsageSectionExpanded &&
  left.terminalCompletionSound === right.terminalCompletionSound &&
  areStringArraysEqual(left.minimizedTerminalIds, right.minimizedTerminalIds) &&
  areNumberRecordMapsEqual(left.terminalWidths, right.terminalWidths) &&
  areStringArraysEqual(left.canvasOpenTerminalIds, right.canvasOpenTerminalIds) &&
  areStringArraysEqual(left.canvasOpenCoordinationIds, right.canvasOpenCoordinationIds) &&
  left.canvasTerminalsPanelWidth === right.canvasTerminalsPanelWidth;

type UsePersistedUiStateResult = {
  activePrimaryNav: PrimaryNavIndex;
  setActivePrimaryNav: Dispatch<SetStateAction<PrimaryNavIndex>>;
  isUiStateHydrated: boolean;
  setIsUiStateHydrated: Dispatch<SetStateAction<boolean>>;
  hasHydratedUiStateSnapshot: boolean;
  isAgentsSidebarVisible: boolean;
  setIsAgentsSidebarVisible: Dispatch<SetStateAction<boolean>>;
  sidebarWidth: number;
  setSidebarWidth: Dispatch<SetStateAction<number>>;
  isActiveAgentsSectionExpanded: boolean;
  setIsActiveAgentsSectionExpanded: Dispatch<SetStateAction<boolean>>;
  isRuntimeStatusStripVisible: boolean;
  setIsRuntimeStatusStripVisible: Dispatch<SetStateAction<boolean>>;
  isMonitorVisible: boolean;
  setIsMonitorVisible: Dispatch<SetStateAction<boolean>>;
  isBottomTelemetryVisible: boolean;
  setIsBottomTelemetryVisible: Dispatch<SetStateAction<boolean>>;
  isCodexUsageVisible: boolean;
  setIsCodexUsageVisible: Dispatch<SetStateAction<boolean>>;
  isCodexUsageSectionExpanded: boolean;
  setIsCodexUsageSectionExpanded: Dispatch<SetStateAction<boolean>>;
  terminalCompletionSound: TerminalCompletionSoundId;
  setTerminalCompletionSound: Dispatch<SetStateAction<TerminalCompletionSoundId>>;
  minimizedTerminalIds: string[];
  setMinimizedTerminalIds: Dispatch<SetStateAction<string[]>>;
  terminalWidths: Record<string, number>;
  setTerminalWidths: Dispatch<SetStateAction<Record<string, number>>>;
  canvasOpenTerminalIds: string[];
  setCanvasOpenTerminalIds: Dispatch<SetStateAction<string[]>>;
  canvasOpenCoordinationIds: string[];
  setCanvasOpenCoordinationIds: Dispatch<SetStateAction<string[]>>;
  canvasTerminalsPanelWidth: number | null;
  setCanvasTerminalsPanelWidth: Dispatch<SetStateAction<number | null>>;
  readUiState: (signal?: AbortSignal) => Promise<FrontendUiStateSnapshot | null>;
  applyHydratedUiState: (
    snapshot: FrontendUiStateSnapshot | null,
    nextColumns: TerminalView,
  ) => void;
};

export const usePersistedUiState = ({
  columns,
}: UsePersistedUiStateOptions): UsePersistedUiStateResult => {
  const [activePrimaryNav, setActivePrimaryNav] = useState<PrimaryNavIndex>(
    DEFAULT_ACTIVE_PRIMARY_NAV,
  );
  const [isAgentsSidebarVisible, setIsAgentsSidebarVisible] = useState(
    DEFAULT_IS_AGENTS_SIDEBAR_VISIBLE,
  );
  const [sidebarWidth, setSidebarWidth] = useState(MIN_SIDEBAR_WIDTH);
  const [isActiveAgentsSectionExpanded, setIsActiveAgentsSectionExpanded] = useState(
    DEFAULT_IS_ACTIVE_AGENTS_SECTION_EXPANDED,
  );
  const [isRuntimeStatusStripVisible, setIsRuntimeStatusStripVisible] = useState(
    DEFAULT_IS_RUNTIME_STATUS_STRIP_VISIBLE,
  );
  const [isMonitorVisible, setIsMonitorVisible] = useState(DEFAULT_IS_MONITOR_VISIBLE);
  const [isBottomTelemetryVisible, setIsBottomTelemetryVisible] = useState(
    DEFAULT_IS_BOTTOM_TELEMETRY_VISIBLE,
  );
  const [isCodexUsageVisible, setIsCodexUsageVisible] = useState(DEFAULT_IS_CODEX_USAGE_VISIBLE);
  const [isCodexUsageSectionExpanded, setIsCodexUsageSectionExpanded] = useState(
    DEFAULT_IS_CODEX_USAGE_SECTION_EXPANDED,
  );
  const [terminalCompletionSound, setTerminalCompletionSound] = useState<TerminalCompletionSoundId>(
    DEFAULT_TERMINAL_COMPLETION_SOUND,
  );
  const [isUiStateHydrated, setIsUiStateHydrated] = useState(false);
  const [hasHydratedUiStateSnapshot, setHasHydratedUiStateSnapshot] = useState(false);
  const [minimizedTerminalIds, setMinimizedTerminalIds] = useState<string[]>(
    DEFAULT_MINIMIZED_TERMINAL_IDS,
  );
  const [terminalWidths, setTerminalWidths] =
    useState<Record<string, number>>(DEFAULT_TERMINAL_WIDTHS);
  const [canvasOpenTerminalIds, setCanvasOpenTerminalIds] = useState<string[]>(
    DEFAULT_CANVAS_OPEN_TERMINAL_IDS,
  );
  const [canvasOpenCoordinationIds, setCanvasOpenCoordinationIds] = useState<string[]>(
    DEFAULT_CANVAS_OPEN_COORDINATION_IDS,
  );
  const [canvasTerminalsPanelWidth, setCanvasTerminalsPanelWidth] = useState<number | null>(null);
  const lastPersistedUiStateRef = useRef<FrontendUiStateSnapshot | null>(null);

  const readUiState = useCallback(async (signal?: AbortSignal) => {
    try {
      const requestOptions: {
        method: "GET";
        headers: { Accept: string };
        signal?: AbortSignal;
      } = {
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
    } catch {
      return null;
    }
  }, []);

  const applyHydratedUiState = useCallback(
    (snapshot: FrontendUiStateSnapshot | null, nextColumns: TerminalView) => {
      const activeTerminalIds = new Set(nextColumns.map((entry) => entry.terminalId));
      const activeOrchestrationIds = new Set(nextColumns.map((entry) => entry.coordinationId));
      const hasPersistedSnapshot = snapshot !== null && Object.keys(snapshot).length > 0;
      setHasHydratedUiStateSnapshot(hasPersistedSnapshot);

      if (!snapshot) {
        lastPersistedUiStateRef.current = buildPersistedUiStateSnapshot({
          activePrimaryNav: DEFAULT_ACTIVE_PRIMARY_NAV,
          isAgentsSidebarVisible: DEFAULT_IS_AGENTS_SIDEBAR_VISIBLE,
          sidebarWidth: MIN_SIDEBAR_WIDTH,
          isActiveAgentsSectionExpanded: DEFAULT_IS_ACTIVE_AGENTS_SECTION_EXPANDED,
          isRuntimeStatusStripVisible: DEFAULT_IS_RUNTIME_STATUS_STRIP_VISIBLE,
          isMonitorVisible: DEFAULT_IS_MONITOR_VISIBLE,
          isBottomTelemetryVisible: DEFAULT_IS_BOTTOM_TELEMETRY_VISIBLE,
          isCodexUsageVisible: DEFAULT_IS_CODEX_USAGE_VISIBLE,
          isCodexUsageSectionExpanded: DEFAULT_IS_CODEX_USAGE_SECTION_EXPANDED,
          terminalCompletionSound: DEFAULT_TERMINAL_COMPLETION_SOUND,
          minimizedTerminalIds: DEFAULT_MINIMIZED_TERMINAL_IDS,
          terminalWidths: DEFAULT_TERMINAL_WIDTHS,
          canvasOpenTerminalIds: DEFAULT_CANVAS_OPEN_TERMINAL_IDS,
          canvasOpenCoordinationIds: DEFAULT_CANVAS_OPEN_COORDINATION_IDS,
          canvasTerminalsPanelWidth: null,
        });
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
        activePrimaryNav:
          snapshot.activePrimaryNav !== undefined &&
          snapshot.activePrimaryNav >= 1 &&
          snapshot.activePrimaryNav <= PRIMARY_NAV_ITEMS.length
            ? (snapshot.activePrimaryNav as PrimaryNavIndex)
            : DEFAULT_ACTIVE_PRIMARY_NAV,
        isAgentsSidebarVisible:
          snapshot.isAgentsSidebarVisible ?? DEFAULT_IS_AGENTS_SIDEBAR_VISIBLE,
        sidebarWidth: snapshot.sidebarWidth ?? MIN_SIDEBAR_WIDTH,
        isActiveAgentsSectionExpanded:
          snapshot.isActiveAgentsSectionExpanded ?? DEFAULT_IS_ACTIVE_AGENTS_SECTION_EXPANDED,
        isRuntimeStatusStripVisible:
          snapshot.isRuntimeStatusStripVisible ?? DEFAULT_IS_RUNTIME_STATUS_STRIP_VISIBLE,
        isMonitorVisible: snapshot.isMonitorVisible ?? DEFAULT_IS_MONITOR_VISIBLE,
        isBottomTelemetryVisible:
          snapshot.isBottomTelemetryVisible ?? DEFAULT_IS_BOTTOM_TELEMETRY_VISIBLE,
        isCodexUsageVisible: snapshot.isCodexUsageVisible ?? DEFAULT_IS_CODEX_USAGE_VISIBLE,
        isCodexUsageSectionExpanded:
          snapshot.isCodexUsageSectionExpanded ?? DEFAULT_IS_CODEX_USAGE_SECTION_EXPANDED,
        terminalCompletionSound:
          snapshot.terminalCompletionSound ?? DEFAULT_TERMINAL_COMPLETION_SOUND,
        minimizedTerminalIds: nextMinimizedTerminalIds,
        terminalWidths: nextTerminalWidths,
        canvasOpenTerminalIds: nextCanvasOpenTerminalIds,
        canvasOpenCoordinationIds: nextCanvasOpenCoordinationIds,
        canvasTerminalsPanelWidth: snapshot.canvasTerminalsPanelWidth ?? null,
      });

      if (
        snapshot.activePrimaryNav !== undefined &&
        snapshot.activePrimaryNav >= 1 &&
        snapshot.activePrimaryNav <= PRIMARY_NAV_ITEMS.length
      ) {
        setActivePrimaryNav(snapshot.activePrimaryNav as PrimaryNavIndex);
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

      if (snapshot.isMonitorVisible !== undefined) {
        setIsMonitorVisible(snapshot.isMonitorVisible);
      }

      if (snapshot.isBottomTelemetryVisible !== undefined) {
        setIsBottomTelemetryVisible(snapshot.isBottomTelemetryVisible);
      }

      if (snapshot.isCodexUsageVisible !== undefined) {
        setIsCodexUsageVisible(snapshot.isCodexUsageVisible);
      }

      if (snapshot.isCodexUsageSectionExpanded !== undefined) {
        setIsCodexUsageSectionExpanded(snapshot.isCodexUsageSectionExpanded);
      }

      if (snapshot.terminalCompletionSound !== undefined) {
        setTerminalCompletionSound(snapshot.terminalCompletionSound);
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
    },
    [],
  );

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

    const payload = buildPersistedUiStateSnapshot({
      activePrimaryNav,
      isAgentsSidebarVisible,
      sidebarWidth,
      isActiveAgentsSectionExpanded,
      isRuntimeStatusStripVisible,
      isMonitorVisible,
      isBottomTelemetryVisible,
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
        .catch((error: unknown) => {
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
    isBottomTelemetryVisible,
    isRuntimeStatusStripVisible,
    isMonitorVisible,
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
    isMonitorVisible,
    setIsMonitorVisible,
    isBottomTelemetryVisible,
    setIsBottomTelemetryVisible,
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
