import { useMemo } from "react";
import { useTerminalRuntimeStates, } from "../terminalRuntimeStateStore";
export const useAgentRuntimeStates = (runtimeStateStore, columns) => {
    const terminalIds = useMemo(() => columns.map((column) => column.terminalId), [columns]);
    return useTerminalRuntimeStates(runtimeStateStore, terminalIds);
};
