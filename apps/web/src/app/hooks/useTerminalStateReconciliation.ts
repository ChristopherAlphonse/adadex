import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";

import { retainActiveTerminalIds } from "../terminalState";
import type { TerminalView } from "../types";

type UseTerminalStateReconciliationOptions = {
  columns: TerminalView;
  setMinimizedTerminalIds: Dispatch<SetStateAction<string[]>>;
  onActiveTerminalIdsChange?: (activeTerminalIds: ReadonlySet<string>) => void;
};

export const useTerminalStateReconciliation = ({
  columns,
  setMinimizedTerminalIds,
  onActiveTerminalIdsChange,
}: UseTerminalStateReconciliationOptions) => {
  useEffect(() => {
    const activeTerminalIds = new Set(columns.map((entry) => entry.terminalId));
    setMinimizedTerminalIds((current) => retainActiveTerminalIds(current, activeTerminalIds));
    onActiveTerminalIdsChange?.(activeTerminalIds);
  }, [columns, onActiveTerminalIdsChange, setMinimizedTerminalIds]);
};
