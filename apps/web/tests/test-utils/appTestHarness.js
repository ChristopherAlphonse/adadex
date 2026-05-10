import { vi } from "vitest";
export class MockWebSocket {
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
export const resetAppTestHarness = () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    MockWebSocket.instances = [];
};
export const jsonResponse = (payload, status = 200) => new Response(JSON.stringify(payload), {
    status,
    headers: {
        "Content-Type": "application/json",
    },
});
export const notFoundResponse = () => new Response("not-found", { status: 404 });
