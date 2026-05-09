import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Terminal } from "../src/components/Terminal";

type Listener = (event: { data: unknown }) => void;

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  readonly url: string;
  private listeners = new Map<string, Set<Listener>>();

  close = vi.fn();
  send = vi.fn();

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: Listener) {
    const bucket = this.listeners.get(type) ?? new Set<Listener>();
    bucket.add(listener);
    this.listeners.set(type, bucket);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string, data?: unknown) {
    const event = { data };
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

describe("Terminal", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    MockWebSocket.instances = [];
  });

  it("renders idle badge and updates it from websocket state events", async () => {
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);

    render(<Terminal terminalId="tentacle-a" />);

    expect(screen.getByText("IDLE")).toBeInTheDocument();

    await waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1);
    });

    const socket = MockWebSocket.instances[0];
    if (!socket) {
      throw new Error("Expected websocket instance");
    }
    socket.emit("message", JSON.stringify({ type: "state", state: "processing" }));

    await waitFor(() => {
      const badge = screen.getByText("PROCESSING").closest(".status-badge");
      expect(badge).not.toBeNull();
      expect(badge).toHaveClass("pill", "processing");
    });

    socket.emit("message", JSON.stringify({ type: "state", state: "idle" }));

    await waitFor(() => {
      const badge = screen.getByText("IDLE").closest(".status-badge");
      expect(badge).not.toBeNull();
      expect(badge).toHaveClass("pill", "idle");
    });
  });

  it("renders terminal with the provided terminal label", async () => {
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);

    render(<Terminal terminalId="tentacle-a-agent-1" terminalLabel="tentacle-a-agent-1" />);

    expect(screen.getByText("tentacle-a-agent-1")).toBeInTheDocument();
  });
});
