import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CanvasOrchestrationPanel } from "../src/components/canvas/CanvasOrchestrationPanel";

const orchestration = {
  coordinationId: "docs-knowledge",
  displayName: "Docs & Knowledge",
  description: "Keep docs aligned with the product.",
  status: "active" as const,
  color: "#ff6b2b",
  mascot: {
    animation: null,
    expression: null,
    accessory: null,
    hairColor: null,
  },
  scope: { paths: [], tags: [] },
  vaultFiles: ["todo.md"],
  todoTotal: 2,
  todoDone: 0,
  todoItems: [
    { text: "Audit docs", done: false },
    { text: "Consolidate principles", done: false },
  ],
  suggestedSkills: ["docs-writer", "release-helper"],
};

describe("CanvasOrchestrationPanel actions", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("offers worktree and normal swarm options", async () => {
    const onSpawnSwarm = vi.fn();

    render(
      <CanvasOrchestrationPanel
        node={{
          id: "docs-knowledge",
          type: "orchestration",
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          pinned: false,
          radius: 48,
          coordinationId: "docs-knowledge",
          label: "Docs & Knowledge",
          color: "#ff6b2b",
        }}
        orchestration={orchestration}
        sessions={[]}
        onClose={() => {}}
        onSpawnSwarm={onSpawnSwarm}
      />,
    );

    const worktreeButton = await screen.findByRole("button", {
      name: /spawn swarm \(worktrees\)/i,
    });
    const normalButton = await screen.findByRole("button", {
      name: /spawn swarm \(normal\)/i,
    });

    fireEvent.click(worktreeButton);
    fireEvent.click(normalButton);

    expect(onSpawnSwarm).toHaveBeenNthCalledWith(1, "docs-knowledge", "worktree");
    expect(onSpawnSwarm).toHaveBeenNthCalledWith(2, "docs-knowledge", "shared");
  });

  it("spawns a dedicated agent for an individual todo item", async () => {
    const onSolveTodoItem = vi.fn();

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);

      if (url.endsWith("/api/deck/coordinations/docs-knowledge/todo/solve")) {
        expect(init?.method).toBe("POST");
        expect(init?.body).toBe(JSON.stringify({ itemIndex: 0 }));
        return new Response(JSON.stringify({ terminalId: "docs-knowledge-todo-0" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response("not-found", { status: 404 });
    });

    render(
      <CanvasOrchestrationPanel
        node={{
          id: "docs-knowledge",
          type: "orchestration",
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          pinned: false,
          radius: 48,
          coordinationId: "docs-knowledge",
          label: "Docs & Knowledge",
          color: "#ff6b2b",
        }}
        orchestration={orchestration}
        sessions={[]}
        onClose={() => {}}
        onSolveTodoItem={onSolveTodoItem}
      />,
    );

    const solveButtons = await screen.findAllByRole("button", {
      name: /spawn agent for todo item/i,
    });

    fireEvent.click(solveButtons[0] as HTMLElement);

    await waitFor(() => {
      expect(onSolveTodoItem).toHaveBeenCalledWith("docs-knowledge", 0);
    });
  });

  it("refreshes centralized orchestration data after mutating todo items", async () => {
    const onRefreshOrchestrationData = vi.fn().mockResolvedValue(undefined);

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);

      if (url.endsWith("/api/deck/coordinations/docs-knowledge/todo/toggle")) {
        expect(init?.method).toBe("PATCH");
        expect(init?.body).toBe(JSON.stringify({ itemIndex: 0, done: true }));
        return new Response(null, { status: 200 });
      }

      return new Response("not-found", { status: 404 });
    });

    render(
      <CanvasOrchestrationPanel
        node={{
          id: "docs-knowledge",
          type: "orchestration",
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          pinned: false,
          radius: 48,
          coordinationId: "docs-knowledge",
          label: "Docs & Knowledge",
          color: "#ff6b2b",
        }}
        orchestration={orchestration}
        sessions={[]}
        onClose={() => {}}
        onRefreshOrchestrationData={onRefreshOrchestrationData}
      />,
    );

    fireEvent.click((await screen.findAllByRole("checkbox"))[0] as HTMLElement);

    await waitFor(() => {
      expect(onRefreshOrchestrationData).toHaveBeenCalledTimes(1);
    });
  });

  it("shows suggested skills in the orchestration detail panel", async () => {
    render(
      <CanvasOrchestrationPanel
        node={{
          id: "docs-knowledge",
          type: "orchestration",
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          pinned: false,
          radius: 48,
          coordinationId: "docs-knowledge",
          label: "Docs & Knowledge",
          color: "#ff6b2b",
        }}
        orchestration={orchestration}
        sessions={[]}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText("Suggested Skills")).toBeInTheDocument();
    expect(screen.getByText("docs-writer")).toBeInTheDocument();
    expect(screen.getByText("release-helper")).toBeInTheDocument();
  });
});
