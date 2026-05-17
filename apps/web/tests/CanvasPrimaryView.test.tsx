import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CanvasPrimaryView } from "../src/components/CanvasPrimaryView";

type MockCanvasNode = {
  id: string;
  type: "orchestration" | "active-session";
  coordinationId: string;
  label: string;
  color: string;
  x: number;
  y: number;
  radius: number;
  sessionId?: string;
  agentState?: "live";
  agentRuntimeState?: "idle";
  hasUserPrompt?: boolean;
  workspaceMode?: "shared";
  parentTerminalId?: string;
};

const nodes: MockCanvasNode[] = [
  {
    id: "t:orchestration-a",
    type: "orchestration" as const,
    coordinationId: "orchestration-a",
    label: "orchestration-a",
    color: "#ff6b2b",
    x: 80,
    y: 80,
    radius: 28,
  },
  {
    id: "a:terminal-1",
    type: "active-session" as const,
    sessionId: "terminal-1",
    coordinationId: "orchestration-a",
    label: "terminal-1",
    color: "#ff6b2b",
    x: 120,
    y: 120,
    radius: 20,
    agentState: "live" as const,
    agentRuntimeState: "idle" as const,
    hasUserPrompt: true,
    workspaceMode: "shared" as const,
  },
];

vi.mock("../src/app/hooks/useAgentRuntimeStates", () => ({
  useAgentRuntimeStates: () => new Map(),
}));

vi.mock("../src/app/hooks/useCanvasGraphData", () => ({
  useCanvasGraphData: () => ({
    nodes,
    edges: [],
    orchestrationById: new Map(),
    sessionsByOrchestrationId: new Map(),
    refresh: vi.fn(),
    refreshDeckOrchestrations: vi.fn(),
  }),
}));

vi.mock("../src/app/hooks/useCanvasTransform", () => ({
  useCanvasTransform: () => ({
    transform: { translateX: 0, translateY: 0, scale: 1 },
    isPanning: false,
    svgRef: { current: null },
    handleWheel: vi.fn(),
    handlePointerDown: vi.fn(),
    handlePointerMove: vi.fn(),
    handlePointerUp: vi.fn(),
    screenToGraph: () => ({ x: 0, y: 0 }),
    fitAll: vi.fn(),
  }),
}));

vi.mock("../src/app/hooks/useForceSimulation", () => ({
  DEFAULT_FORCE_PARAMS: {},
  useForceSimulation: ({ nodes: nextNodes }: { nodes: typeof nodes }) => ({
    simulatedNodes: nextNodes,
    pinNode: vi.fn(),
    unpinNode: vi.fn(),
    moveNode: vi.fn(),
    reheat: vi.fn(),
  }),
}));

vi.mock("../src/components/canvas/SessionNode", () => ({
  SessionNode: ({
    node,
    onClick,
  }: {
    node: (typeof nodes)[number];
    onClick: (nodeId: string) => void;
  }) => (
    <button type="button" data-node-id={node.id} onClick={() => onClick(node.id)}>
      {node.label}
    </button>
  ),
}));

vi.mock("../src/components/canvas/OctopusNode", () => ({
  OctopusNode: ({
    node,
    onClick,
  }: {
    node: (typeof nodes)[number];
    onClick: (nodeId: string) => void;
  }) => (
    <g
      data-node-id={node.id}
      onClick={() => onClick(node.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          onClick(node.id);
        }
      }}
    >
      <circle cx={node.x} cy={node.y} r={node.radius} />
      <title>{node.label}</title>
    </g>
  ),
}));

vi.mock("../src/components/canvas/CanvasTerminalColumn", () => ({
  CanvasTerminalColumn: ({
    node,
    panelRef,
    onMinimize,
    onClose,
    onFocus,
  }: {
    node: (typeof nodes)[number];
    panelRef?: ((element: HTMLElement | null) => void) | undefined;
    onMinimize?: () => void;
    onClose?: () => void;
    onFocus?: () => void;
  }) => (
    <section
      ref={panelRef}
      data-testid={`panel-${node.id}`}
      tabIndex={-1}
      onFocusCapture={onFocus}
      onPointerDown={onFocus}
    >
      panel {node.id} label {node.label}
      <button type="button" onClick={onMinimize}>
        Minimize terminal panel
      </button>
      <button type="button" onClick={onClose}>
        Close terminal session
      </button>
    </section>
  ),
}));

vi.mock("../src/components/canvas/CanvasOrchestrationPanel", () => ({
  CanvasOrchestrationPanel: () => null,
}));

describe("CanvasPrimaryView", () => {
  beforeEach(() => {
    let rafId = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(
      (callback: FrameRequestCallback) => {
        const id = ++rafId;
        setTimeout(() => callback(0), 0);
        return id;
      },
    );
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
      writable: true,
    });
    Object.defineProperty(HTMLElement.prototype, "focus", {
      configurable: true,
      value: vi.fn(),
      writable: true,
    });
  });

  afterEach(() => {
    cleanup();
    nodes.splice(2);
    vi.restoreAllMocks();
  });

  it("reveals and focuses a newly opened terminal panel when a session node is clicked", async () => {
    render(<CanvasPrimaryView columns={[]} isUiStateHydrated />);

    const [terminalButton] = screen.getAllByRole("button", { name: "terminal-1" });
    expect(terminalButton).toBeDefined();
    if (!terminalButton) throw new Error("Missing terminal button");

    fireEvent.click(terminalButton);

    await waitFor(() => {
      expect(screen.getByTestId("panel-a:terminal-1")).toBeInTheDocument();
      expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
      expect(HTMLElement.prototype.focus).toHaveBeenCalledTimes(1);
    });
  });

  it("does not focus the terminal panel when an already-open terminal is clicked", async () => {
    render(<CanvasPrimaryView columns={[]} isUiStateHydrated />);

    const [terminalButton] = screen.getAllByRole("button", { name: "terminal-1" });
    expect(terminalButton).toBeDefined();
    if (!terminalButton) throw new Error("Missing terminal button");

    fireEvent.click(terminalButton);

    await waitFor(() => {
      expect(screen.getByTestId("panel-a:terminal-1")).toBeInTheDocument();
      expect(HTMLElement.prototype.focus).toHaveBeenCalledTimes(1);
    });

    fireEvent.keyDown(screen.getByLabelText("Canvas graph"), { key: "Escape" });
    vi.mocked(HTMLElement.prototype.focus).mockClear();

    fireEvent.pointerDown(screen.getByTestId("panel-a:terminal-1"));

    expect(HTMLElement.prototype.focus).not.toHaveBeenCalled();
  });

  it("minimizes a terminal panel separately from shutting down the terminal session", async () => {
    const onCloseActiveSession = vi.fn();
    render(
      <CanvasPrimaryView
        columns={[
          {
            terminalId: "terminal-1",
            label: "terminal-1",
            state: "live",
            coordinationId: "orchestration-a",
            coordinationName: "terminal one",
            workspaceMode: "shared",
            createdAt: "2026-02-24T10:00:00.000Z",
          },
        ]}
        isUiStateHydrated
        onCloseActiveSession={onCloseActiveSession}
      />,
    );

    const [terminalButton] = screen.getAllByRole("button", { name: "terminal-1" });
    expect(terminalButton).toBeDefined();
    if (!terminalButton) throw new Error("Missing terminal button");

    fireEvent.click(terminalButton);
    await waitFor(() => {
      expect(screen.getByTestId("panel-a:terminal-1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Minimize terminal panel" }));
    expect(screen.queryByTestId("panel-a:terminal-1")).not.toBeInTheDocument();
    expect(onCloseActiveSession).not.toHaveBeenCalled();

    fireEvent.click(terminalButton);
    await waitFor(() => {
      expect(screen.getByTestId("panel-a:terminal-1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Close terminal session" }));
    expect(screen.queryByTestId("panel-a:terminal-1")).not.toBeInTheDocument();
    expect(onCloseActiveSession).toHaveBeenCalledWith("terminal-1", "terminal one", "shared");
  });

  it("auto-opens a newly created child terminal when its parent panel is already open", async () => {
    const { rerender } = render(
      <CanvasPrimaryView
        columns={[
          {
            terminalId: "terminal-1",
            label: "terminal-1",
            state: "live",
            coordinationId: "orchestration-a",
            createdAt: "2026-02-24T10:00:00.000Z",
          },
        ]}
        isUiStateHydrated
      />,
    );

    const [terminalButton] = screen.getAllByRole("button", { name: "terminal-1" });
    expect(terminalButton).toBeDefined();
    if (!terminalButton) throw new Error("Missing terminal button");

    fireEvent.click(terminalButton);

    await waitFor(() => {
      expect(screen.getByTestId("panel-a:terminal-1")).toBeInTheDocument();
    });

    nodes.push({
      id: "a:terminal-2",
      type: "active-session" as const,
      sessionId: "terminal-2",
      coordinationId: "orchestration-a",
      label: "terminal-2",
      color: "#ff6b2b",
      x: 160,
      y: 160,
      radius: 20,
      agentState: "live" as const,
      agentRuntimeState: "idle" as const,
      hasUserPrompt: true,
      workspaceMode: "shared" as const,
      parentTerminalId: "terminal-1",
    });

    rerender(
      <CanvasPrimaryView
        columns={[
          {
            terminalId: "terminal-1",
            label: "terminal-1",
            state: "live",
            coordinationId: "orchestration-a",
            createdAt: "2026-02-24T10:00:00.000Z",
          },
          {
            terminalId: "terminal-2",
            label: "terminal-2",
            state: "live",
            coordinationId: "orchestration-a",
            coordinationName: "orchestration-a",
            parentTerminalId: "terminal-1",
            workspaceMode: "shared",
            createdAt: "2026-02-24T10:05:00.000Z",
            hasUserPrompt: true,
          },
        ]}
        isUiStateHydrated
        recentlyCreatedTerminal={{
          terminalId: "terminal-2",
          label: "terminal-2",
          state: "live",
          coordinationId: "orchestration-a",
          coordinationName: "orchestration-a",
          parentTerminalId: "terminal-1",
          workspaceMode: "shared",
          createdAt: "2026-02-24T10:05:00.000Z",
          hasUserPrompt: true,
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("panel-a:terminal-2")).toBeInTheDocument();
    });
  });

  it("updates an open terminal panel label when the terminal is renamed", async () => {
    const { rerender } = render(
      <CanvasPrimaryView
        columns={[
          {
            terminalId: "terminal-1",
            label: "terminal-1",
            state: "live",
            coordinationId: "orchestration-a",
            coordinationName: "orchestration-a",
            createdAt: "2026-02-24T10:00:00.000Z",
          },
        ]}
        isUiStateHydrated
      />,
    );

    const [terminalButton] = screen.getAllByRole("button", { name: "terminal-1" });
    expect(terminalButton).toBeDefined();
    if (!terminalButton) throw new Error("Missing terminal button");

    fireEvent.click(terminalButton);

    await waitFor(() => {
      expect(screen.getByTestId("panel-a:terminal-1")).toHaveTextContent(
        "panel a:terminal-1 label orchestration-a",
      );
    });

    rerender(
      <CanvasPrimaryView
        columns={[
          {
            terminalId: "terminal-1",
            label: "terminal-1",
            state: "live",
            coordinationId: "orchestration-a",
            coordinationName: "renamed-orchestration",
            createdAt: "2026-02-24T10:00:00.000Z",
          },
        ]}
        isUiStateHydrated
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("panel-a:terminal-1")).toHaveTextContent(
        "panel a:terminal-1 label renamed-orchestration",
      );
    });
  });

  it("shows orchestration maintenance actions in the context menu and passes the orchestration ID", async () => {
    const onOrchestrationAction = vi.fn().mockResolvedValue(undefined);

    const { container } = render(
      <CanvasPrimaryView
        columns={[]}
        isUiStateHydrated
        onOrchestrationAction={onOrchestrationAction}
      />,
    );

    const orchestrationNode = container.querySelector('[data-node-id="t:orchestration-a"]');
    expect(orchestrationNode).not.toBeNull();

    fireEvent.contextMenu(orchestrationNode as Element, { clientX: 160, clientY: 120 });

    expect(await screen.findByRole("button", { name: "Update To-Do List" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update Orchestration" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Update To-Do List" }));

    await waitFor(() => {
      expect(onOrchestrationAction).toHaveBeenCalledWith(
        "orchestration-a",
        "coordination-reorganize-todos",
      );
    });
  });
});
