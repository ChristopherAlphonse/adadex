export const retainActiveTerminalIds = (
  terminalIds: string[],
  activeTerminalIds: ReadonlySet<string>,
) => {
  const nextTerminalIds = terminalIds.filter((terminalId) => activeTerminalIds.has(terminalId));
  return nextTerminalIds.length === terminalIds.length ? terminalIds : nextTerminalIds;
};

export const retainActiveTerminalEntries = <TState>(
  state: Record<string, TState>,
  activeTerminalIds: ReadonlySet<string>,
) => {
  const retainedStateEntries = Object.entries(state).filter(([terminalId]) =>
    activeTerminalIds.has(terminalId),
  );
  if (retainedStateEntries.length === Object.keys(state).length) {
    return state;
  }

  return Object.fromEntries(retainedStateEntries);
};
