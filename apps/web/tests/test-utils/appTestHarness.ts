import type { ParsedValue } from "@adadex/core";
import { vi } from "vitest";

type SocketListener = (event: { data: ParsedValue | undefined }) => void;

export class MockWebSocket {
  static instances: MockWebSocket[] = [];
  readonly url: string;
  private listeners = new Map<string, Set<SocketListener>>();

  close = vi.fn();
  send = vi.fn();

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: SocketListener) {
    const bucket = this.listeners.get(type) ?? new Set<SocketListener>();

    bucket.add(listener);
    this.listeners.set(type, bucket);
  }

  removeEventListener(type: string, listener: SocketListener) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string, data?: ParsedValue) {
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

export const jsonResponse = (payload: ParsedValue, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });

export const notFoundResponse = () => new Response("not-found", { status: 404 });
