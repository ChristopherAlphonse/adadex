import type { TerminalCompletionSoundId } from "./completionSound";

export type PersistedUiState = {
  activePrimaryNav?: number;
  isAgentsSidebarVisible?: boolean;
  sidebarWidth?: number;
  isActiveAgentsSectionExpanded?: boolean;
  isRuntimeStatusStripVisible?: boolean;
  isMonitorVisible?: boolean;
  isCodexUsageVisible?: boolean;
  isCodexUsageSectionExpanded?: boolean;
  terminalCompletionSound?: TerminalCompletionSoundId;
  minimizedTerminalIds?: string[];
  terminalWidths?: Record<string, number>;
  canvasOpenTerminalIds?: string[];
  canvasOpenCoordinationIds?: string[];
  canvasTerminalsPanelWidth?: number;
  terminalInactivityThresholdMs?: number;
};
