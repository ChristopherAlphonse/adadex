import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MockWebSocket, resetAppTestHarness } from "./test-utils/appTestHarness";
const persistedUiStateMock = {
    activePrimaryNav: 2,
    setActivePrimaryNav: vi.fn(),
    applyHydratedUiState: vi.fn(),
    isActiveAgentsSectionExpanded: true,
    isAgentsSidebarVisible: false,
    isCodexUsageSectionExpanded: true,
    isRuntimeStatusStripVisible: false,
    isUiStateHydrated: true,
    minimizedTerminalIds: [],
    readUiState: vi.fn(),
    setIsActiveAgentsSectionExpanded: vi.fn(),
    setIsAgentsSidebarVisible: vi.fn(),
    setIsCodexUsageSectionExpanded: vi.fn(),
    setIsRuntimeStatusStripVisible: vi.fn(),
    setIsUiStateHydrated: vi.fn(),
    setMinimizedTerminalIds: vi.fn(),
    setSidebarWidth: vi.fn(),
    setTerminalCompletionSound: vi.fn(),
    sidebarWidth: 280,
    terminalCompletionSound: "pop",
    canvasOpenTerminalIds: [],
    setCanvasOpenTerminalIds: vi.fn(),
    canvasOpenCoordinationIds: [],
    setCanvasOpenCoordinationIds: vi.fn(),
    canvasTerminalsPanelWidth: null,
    setCanvasTerminalsPanelWidth: vi.fn(),
};
vi.mock("../src/app/hooks/useBackendLivenessPolling", () => ({
    useBackendLivenessPolling: () => "online",
}));
vi.mock("../src/app/hooks/useCodexUsagePolling", () => ({
    useCodexUsagePolling: () => ({
        codexUsageSnapshot: null,
        isRefreshingCodexUsage: false,
        refreshCodexUsage: vi.fn(),
    }),
}));
vi.mock("../src/app/hooks/useConsoleKeyboardShortcuts", () => ({
    useConsoleKeyboardShortcuts: () => { },
}));
vi.mock("../src/app/hooks/useGitHubPrimaryViewModel", () => ({
    useGitHubPrimaryViewModel: () => ({
        githubCommitCount30d: "0",
        sparklinePoints: [],
        githubOverviewGraphSeries: [],
        githubOverviewGraphPolylinePoints: "",
        githubOverviewHoverLabel: null,
        githubStatusPill: null,
        githubRepoLabel: "",
        githubStarCountLabel: "",
        githubOpenIssuesLabel: "",
        githubOpenPrsLabel: "",
        githubRecentCommits: [],
    }),
}));
vi.mock("../src/app/hooks/useGithubSummaryPolling", () => ({
    useGithubSummaryPolling: () => ({
        githubRepoSummary: null,
        isRefreshingGitHubSummary: false,
        refreshGitHubRepoSummary: vi.fn(),
    }),
}));
vi.mock("../src/app/hooks/useInitialColumnsHydration", async () => {
    const React = await import("react");
    return {
        useInitialColumnsHydration: ({ setColumns, setIsLoading, setIsUiStateHydrated, }) => {
            React.useEffect(() => {
                setColumns([]);
                setIsLoading(false);
                setIsUiStateHydrated(true);
            }, [setColumns, setIsLoading, setIsUiStateHydrated]);
        },
    };
});
vi.mock("../src/app/hooks/usePersistedUiState", () => ({
    usePersistedUiState: () => persistedUiStateMock,
}));
vi.mock("../src/app/hooks/useOrchestrationGitLifecycle", () => ({
    useOrchestrationGitLifecycle: () => ({
        gitStatusByOrchestrationId: new Map(),
        gitStatusLoadingByOrchestrationId: new Map(),
        pullRequestByOrchestrationId: new Map(),
        pullRequestLoadingByOrchestrationId: new Map(),
        openGitOrchestrationId: null,
        openGitOrchestrationStatus: null,
        openGitOrchestrationPullRequest: null,
        gitCommitMessageDraft: "",
        gitDialogError: null,
        isGitDialogLoading: false,
        isGitDialogMutating: false,
        setGitCommitMessageDraft: vi.fn(),
        openOrchestrationGitActions: vi.fn(),
        closeOrchestrationGitActions: vi.fn(),
        commitOrchestrationChanges: vi.fn(),
        commitAndPushOrchestrationBranch: vi.fn(),
        pushOrchestrationBranch: vi.fn(),
        syncOrchestrationBranch: vi.fn(),
        mergeOrchestrationPullRequest: vi.fn(),
    }),
}));
vi.mock("../src/app/hooks/useTerminalCompletionNotification", () => ({
    useTerminalCompletionNotification: () => ({
        playCompletionSoundPreview: vi.fn(),
    }),
}));
vi.mock("../src/app/hooks/useTerminalMutations", () => ({
    useTerminalMutations: () => ({
        clearPendingDeleteTerminal: vi.fn(),
        closeTerminal: vi.fn(),
        confirmDeleteTerminal: vi.fn(),
        createTerminal: vi.fn(),
        isCreatingTerminal: false,
        isDeletingTerminalId: null,
        pendingDeleteTerminal: null,
        requestDeleteTerminal: vi.fn(),
    }),
}));
vi.mock("../src/app/hooks/useTerminalStateReconciliation", () => ({
    useTerminalStateReconciliation: () => { },
}));
vi.mock("../src/app/hooks/useUsageHeatmapPolling", () => ({
    useUsageHeatmapPolling: () => ({
        heatmapData: [],
        isLoadingHeatmap: false,
        refreshHeatmap: vi.fn(),
    }),
}));
vi.mock("../src/components/ActiveAgentsSidebar", () => ({
    ActiveAgentsSidebar: () => null,
}));
vi.mock("../src/components/ConsolePrimaryNav", () => ({
    ConsolePrimaryNav: () => null,
}));
vi.mock("../src/components/PrimaryViewRouter", () => ({
    PrimaryViewRouter: ({ canvasPrimaryViewProps, }) => (_jsxs("div", { children: [_jsx("button", { type: "button", onClick: () => void canvasPrimaryViewProps.onSpawnSwarm?.("docs-knowledge", "shared"), children: "Spawn Swarm" }), _jsx("span", { children: canvasPrimaryViewProps.onSolveTodoItem
                    ? "solve callback present"
                    : "solve callback omitted" })] })),
}));
vi.mock("../src/components/RuntimeStatusStrip", () => ({
    RuntimeStatusStrip: () => null,
}));
vi.mock("../src/components/SidebarActionPanel", () => ({
    SidebarActionPanel: () => null,
}));
import { App } from "../src/App";
describe("App swarm actions", () => {
    afterEach(() => {
        cleanup();
        resetAppTestHarness();
    });
    it("refreshes terminal snapshots after spawning a swarm", async () => {
        vi.stubGlobal("WebSocket", MockWebSocket);
        let terminalSnapshotReads = 0;
        const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
            const url = String(input);
            const method = init?.method ?? "GET";
            if (url.endsWith("/api/terminal-snapshots") && method === "GET") {
                terminalSnapshotReads += 1;
                return new Response("[]", {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            }
            if (url.endsWith("/api/deck/coordinations/docs-knowledge/swarm") && method === "POST") {
                return new Response(JSON.stringify({ ok: true }), {
                    status: 201,
                    headers: { "Content-Type": "application/json" },
                });
            }
            return new Response("not-found", { status: 404 });
        });
        render(_jsx(App, {}));
        expect(screen.getByText("solve callback omitted")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Spawn Swarm" }));
        await waitFor(() => {
            expect(fetchMock.mock.calls.some(([calledUrl, calledInit]) => String(calledUrl).endsWith("/api/deck/coordinations/docs-knowledge/swarm") &&
                (calledInit?.method ?? "GET") === "POST")).toBe(true);
        });
        await waitFor(() => {
            expect(terminalSnapshotReads).toBe(1);
        });
    });
});
