const isAgentState = (value) => value === "live" ||
    value === "idle" ||
    value === "queued" ||
    value === "blocked" ||
    value === "stopped" ||
    value === "exited" ||
    value === "stale";
const isLifecycleState = (value) => value === "registered" ||
    value === "running" ||
    value === "stopped" ||
    value === "exited" ||
    value === "stale";
const isTerminalSnapshot = (value) => {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const snapshot = value;
    return (typeof snapshot.terminalId === "string" &&
        typeof snapshot.label === "string" &&
        isAgentState(snapshot.state) &&
        typeof snapshot.coordinationId === "string" &&
        (snapshot.coordinationName === undefined || typeof snapshot.coordinationName === "string") &&
        (snapshot.workspaceMode === undefined ||
            snapshot.workspaceMode === "shared" ||
            snapshot.workspaceMode === "worktree") &&
        typeof snapshot.createdAt === "string" &&
        (snapshot.lifecycleState === undefined || isLifecycleState(snapshot.lifecycleState)) &&
        (snapshot.lifecycleReason === undefined || typeof snapshot.lifecycleReason === "string") &&
        (snapshot.lifecycleUpdatedAt === undefined ||
            typeof snapshot.lifecycleUpdatedAt === "string") &&
        (snapshot.processId === undefined || typeof snapshot.processId === "number") &&
        (snapshot.startedAt === undefined || typeof snapshot.startedAt === "string") &&
        (snapshot.endedAt === undefined || typeof snapshot.endedAt === "string") &&
        (snapshot.exitCode === undefined || typeof snapshot.exitCode === "number") &&
        (snapshot.exitSignal === undefined ||
            typeof snapshot.exitSignal === "number" ||
            typeof snapshot.exitSignal === "string"));
};
export class HttpTerminalSnapshotReader {
    endpoint;
    fetcher;
    signal;
    constructor({ endpoint, fetcher, signal }) {
        this.endpoint = endpoint;
        this.fetcher =
            fetcher ??
                ((input, init) => fetch(input, {
                    ...init,
                    signal: init.signal ?? null,
                }));
        this.signal = signal;
    }
    async listTerminalSnapshots() {
        const requestInit = {
            method: "GET",
            headers: {
                Accept: "application/json",
            },
        };
        if (this.signal) {
            requestInit.signal = this.signal;
        }
        const response = await this.fetcher(this.endpoint, requestInit);
        if (!response.ok) {
            throw new Error(`Unable to load terminal snapshots (${response.status})`);
        }
        const payload = await response.json();
        if (!Array.isArray(payload)) {
            return [];
        }
        return payload.filter(isTerminalSnapshot);
    }
}
