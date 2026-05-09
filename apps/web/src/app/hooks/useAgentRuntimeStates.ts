import { useMemo } from "react";

import {
  type TerminalRuntimeStateInfo,
  type TerminalRuntimeStateStore,
  useTerminalRuntimeStates,
} from "../terminalRuntimeStateStore";
import type { TerminalView } from "../types";

export type AgentRuntimeStateInfo = TerminalRuntimeStateInfo;

export const useAgentRuntimeStates = (
  runtimeStateStore: TerminalRuntimeStateStore,
  columns: TerminalView,
): Map<string, AgentRuntimeStateInfo> => {
  const terminalIds = useMemo(() => columns.map((column) => column.terminalId), [columns]);
  return useTerminalRuntimeStates(runtimeStateStore, terminalIds);
};
