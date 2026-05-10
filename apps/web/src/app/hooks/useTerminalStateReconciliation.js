import { useEffect } from "react";
import { retainActiveTerminalIds } from "../terminalState";
export const useTerminalStateReconciliation = ({ columns, setMinimizedTerminalIds, onActiveTerminalIdsChange, }) => {
    useEffect(() => {
        const activeTerminalIds = new Set(columns.map((entry) => entry.terminalId));
        setMinimizedTerminalIds((current) => retainActiveTerminalIds(current, activeTerminalIds));
        onActiveTerminalIdsChange?.(activeTerminalIds);
    }, [columns, onActiveTerminalIdsChange, setMinimizedTerminalIds]);
};
