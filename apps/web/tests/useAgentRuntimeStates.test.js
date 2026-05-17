import { render, screen } from "@testing-library/react";
import { jsx as _jsx } from "react/jsx-runtime";
import { describe, expect, it } from "vitest";
import { useAgentRuntimeStates } from "../src/app/hooks/useAgentRuntimeStates";
import { createTerminalRuntimeStateStore } from "../src/app/terminalRuntimeStateStore";

const HookProbe = ({ columns }) => {
  const runtimeStateStore = createTerminalRuntimeStateStore();
  runtimeStateStore.syncFromTerminals(columns);
  const runtimeStates = useAgentRuntimeStates(runtimeStateStore, columns);
  return _jsx("output", {
    "aria-label": "runtime-states",
    children: JSON.stringify(Array.from(runtimeStates.entries())),
  });
};
describe("useAgentRuntimeStates", () => {
  it("derives per-terminal runtime state from snapshots without opening passive sockets", () => {
    const socketSpy = globalThis.WebSocket;
    const columns = [
      {
        terminalId: "orchestration-idle",
        label: "orchestration-idle",
        state: "live",
        coordinationId: "docs-knowledge",
        createdAt: "2026-04-09T10:00:00.000Z",
      },
      {
        terminalId: "docs-knowledge-swarm-parent",
        label: "docs-knowledge-swarm-parent",
        state: "live",
        coordinationId: "docs-knowledge",
        createdAt: "2026-04-09T10:05:00.000Z",
        agentRuntimeState: "processing",
      },
    ];
    render(_jsx(HookProbe, { columns: columns }));
    expect(screen.getByLabelText("runtime-states").textContent).toBe(
      JSON.stringify([["docs-knowledge-swarm-parent", { state: "processing" }]]),
    );
    expect(globalThis.WebSocket).toBe(socketSpy);
  });
});
