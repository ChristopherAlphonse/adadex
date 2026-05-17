import type { AgentRuntimeState } from "@adadex/core";
import { useEffect, useState } from "react";

import type { TerminalView } from "./types";

export type TerminalRuntimeStateInfo = {
  state: AgentRuntimeState;
  toolName?: string;
};

type Listener = () => void;
type TerminalRuntimeStateMap = Record<string, TerminalRuntimeStateInfo>;

const areRuntimeStatesEqual = (
  left: TerminalRuntimeStateInfo | undefined,
  right: TerminalRuntimeStateInfo | undefined,
) => left?.state === right?.state && left?.toolName === right?.toolName;

const areRuntimeStateMapsEqual = (
  left: ReadonlyMap<string, TerminalRuntimeStateInfo>,
  right: ReadonlyMap<string, TerminalRuntimeStateInfo>,
) => {
  if (left.size !== right.size) {
    return false;
  }

  for (const [terminalId, leftState] of left) {
    if (!areRuntimeStatesEqual(leftState, right.get(terminalId))) {
      return false;
    }
  }

  return true;
};

const sanitizeRuntimeState = (
  state: TerminalRuntimeStateInfo | undefined,
): TerminalRuntimeStateInfo | undefined => {
  if (!state) {
    return undefined;
  }

  return {
    state: state.state,
    ...(state.toolName ? { toolName: state.toolName } : {}),
  };
};

const buildRuntimeStateMap = (terminals: TerminalView): TerminalRuntimeStateMap =>
  terminals.reduce<TerminalRuntimeStateMap>((acc, terminal) => {
    const state = getTerminalRuntimeStateInfo(terminal);
    if (state) {
      acc[terminal.terminalId] = state;
    }
    return acc;
  }, {});

export const getTerminalRuntimeStateInfo = (
  terminal: Pick<TerminalView[number], "agentRuntimeState">,
  toolName?: string,
): TerminalRuntimeStateInfo | undefined => {
  if (!terminal.agentRuntimeState) {
    return undefined;
  }

  return {
    state: terminal.agentRuntimeState,
    ...(toolName ? { toolName } : {}),
  };
};

export const stripTerminalRuntimeState = (terminal: TerminalView[number]): TerminalView[number] => {
  const { agentRuntimeState: _agentRuntimeState, ...structuralTerminal } = terminal;
  return structuralTerminal;
};

export const stripTerminalRuntimeStates = (terminals: TerminalView): TerminalView =>
  terminals.map((terminal) => stripTerminalRuntimeState(terminal));

export const createTerminalRuntimeStateStore = () => {
  let stateByTerminalId: TerminalRuntimeStateMap = {};
  const globalListeners = new Set<Listener>();
  const listenersByTerminalId = new Map<string, Set<Listener>>();

  const notifyListeners = (terminalIds: Iterable<string>) => {
    const listeners = new Set(globalListeners);
    for (const terminalId of terminalIds) {
      const terminalListeners = listenersByTerminalId.get(terminalId);
      if (!terminalListeners) {
        continue;
      }
      for (const listener of terminalListeners) {
        listeners.add(listener);
      }
    }

    for (const listener of listeners) {
      listener();
    }
  };

  const subscribe = (listener: Listener, terminalIds?: Iterable<string>) => {
    if (!terminalIds) {
      globalListeners.add(listener);
      return () => {
        globalListeners.delete(listener);
      };
    }

    const trackedIds = [...terminalIds];
    if (trackedIds.length === 0) {
      return () => {};
    }

    for (const terminalId of trackedIds) {
      const listeners = listenersByTerminalId.get(terminalId);
      if (listeners) {
        listeners.add(listener);
        continue;
      }

      listenersByTerminalId.set(terminalId, new Set([listener]));
    }

    return () => {
      for (const terminalId of trackedIds) {
        const listeners = listenersByTerminalId.get(terminalId);
        if (!listeners) {
          continue;
        }

        listeners.delete(listener);
        if (listeners.size === 0) {
          listenersByTerminalId.delete(terminalId);
        }
      }
    };
  };

  const getRuntimeState = (terminalId: string) => stateByTerminalId[terminalId];

  const getRuntimeStates = (terminalIds: Iterable<string>) => {
    const next = new Map<string, TerminalRuntimeStateInfo>();
    for (const terminalId of terminalIds) {
      const state = stateByTerminalId[terminalId];
      if (state) {
        next.set(terminalId, state);
      }
    }
    return next;
  };

  return {
    subscribe,

    getSnapshot() {
      return stateByTerminalId;
    },

    getRuntimeState,

    getRuntimeStates,

    syncFromTerminals(terminals: TerminalView) {
      const nextStateByTerminalId = buildRuntimeStateMap(terminals);
      const changedTerminalIds = new Set<string>();
      const activeTerminalIds = new Set(Object.keys(nextStateByTerminalId));

      for (const [terminalId, nextState] of Object.entries(nextStateByTerminalId)) {
        if (!areRuntimeStatesEqual(stateByTerminalId[terminalId], nextState)) {
          changedTerminalIds.add(terminalId);
        }
      }

      for (const terminalId of Object.keys(stateByTerminalId)) {
        if (!activeTerminalIds.has(terminalId)) {
          changedTerminalIds.add(terminalId);
        }
      }

      if (changedTerminalIds.size === 0) {
        return;
      }

      stateByTerminalId = nextStateByTerminalId;
      notifyListeners(changedTerminalIds);
    },

    setRuntimeState(terminalId: string, state: TerminalRuntimeStateInfo | undefined) {
      const nextState = sanitizeRuntimeState(state);
      if (areRuntimeStatesEqual(stateByTerminalId[terminalId], nextState)) {
        return;
      }

      if (nextState) {
        stateByTerminalId = {
          ...stateByTerminalId,
          [terminalId]: nextState,
        };
      } else {
        const { [terminalId]: _removedState, ...remainingStates } = stateByTerminalId;
        stateByTerminalId = remainingStates;
      }

      notifyListeners([terminalId]);
    },

    retainTerminalIds(activeTerminalIds: ReadonlySet<string>) {
      const nextEntries = Object.entries(stateByTerminalId).filter(([terminalId]) =>
        activeTerminalIds.has(terminalId),
      );
      if (nextEntries.length === Object.keys(stateByTerminalId).length) {
        return;
      }

      const removedTerminalIds = Object.keys(stateByTerminalId).filter(
        (terminalId) => !activeTerminalIds.has(terminalId),
      );
      stateByTerminalId = Object.fromEntries(nextEntries);
      notifyListeners(removedTerminalIds);
    },

    removeTerminal(terminalId: string) {
      if (!(terminalId in stateByTerminalId)) {
        return;
      }

      const { [terminalId]: _removedState, ...remainingStates } = stateByTerminalId;
      stateByTerminalId = remainingStates;
      notifyListeners([terminalId]);
    },
  };
};

export type TerminalRuntimeStateStore = ReturnType<typeof createTerminalRuntimeStateStore>;

export const useTerminalRuntimeStates = (
  runtimeStateStore: TerminalRuntimeStateStore,
  terminalIds: string[],
): Map<string, TerminalRuntimeStateInfo> => {
  const [runtimeStates, setRuntimeStates] = useState(() =>
    runtimeStateStore.getRuntimeStates(terminalIds),
  );

  useEffect(() => {
    setRuntimeStates((current) => {
      const next = runtimeStateStore.getRuntimeStates(terminalIds);
      return areRuntimeStateMapsEqual(current, next) ? current : next;
    });

    return runtimeStateStore.subscribe(() => {
      setRuntimeStates((current) => {
        const next = runtimeStateStore.getRuntimeStates(terminalIds);
        return areRuntimeStateMapsEqual(current, next) ? current : next;
      });
    }, terminalIds);
  }, [runtimeStateStore, terminalIds]);

  return runtimeStates;
};
