export const retainActiveTerminalIds = (terminalIds, activeTerminalIds) => {
    const nextTerminalIds = terminalIds.filter((terminalId) => activeTerminalIds.has(terminalId));
    return nextTerminalIds.length === terminalIds.length ? terminalIds : nextTerminalIds;
};
export const retainActiveTerminalEntries = (state, activeTerminalIds) => {
    const retainedStateEntries = Object.entries(state).filter(([terminalId]) => activeTerminalIds.has(terminalId));
    if (retainedStateEntries.length === Object.keys(state).length) {
        return state;
    }
    return Object.fromEntries(retainedStateEntries);
};
