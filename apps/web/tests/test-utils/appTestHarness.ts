import { vi } from "vitest";

export class MockWebSocket {
  static instances: MockWebSocket[] = [];
  readonly url: string;
  private listeners = new Map<string, Set<(event: { data: unknown }) => void>>();

  close = vi.fn();
  send = vi.fn();

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: (event: { data: unknown }) => void) {
    const bucket = this.listeners.get(type) ?? new Set<(event: { data: unknown }) => void>();
    bucket.add(listener);
    this.listeners.set(type, bucket);
  }

  removeEventListener(type: string, listener: (event: { data: unknown }) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string, data?: unknown) {
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

export const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });

export const notFoundResponse = () => new Response("not-found", { status: 404 });
