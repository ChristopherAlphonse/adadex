import { jsx as _jsx } from "react/jsx-runtime";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Terminal } from "../src/components/Terminal";
class MockWebSocket {
    static instances = [];
    url;
    listeners = new Map();
    close = vi.fn();
    send = vi.fn();
    constructor(url) {
        this.url = url;
        MockWebSocket.instances.push(this);
    }
    addEventListener(type, listener) {
        const bucket = this.listeners.get(type) ?? new Set();
        bucket.add(listener);
        this.listeners.set(type, bucket);
    }
    removeEventListener(type, listener) {
        this.listeners.get(type)?.delete(listener);
    }
    emit(type, data) {
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
        vi.stubGlobal("WebSocket", MockWebSocket);
        render(_jsx(Terminal, { terminalId: "orchestration-a" }));
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
        vi.stubGlobal("WebSocket", MockWebSocket);
        render(_jsx(Terminal, { terminalId: "orchestration-a-agent-1", terminalLabel: "orchestration-a-agent-1" }));
        expect(screen.getByText("orchestration-a-agent-1")).toBeInTheDocument();
    });
});
