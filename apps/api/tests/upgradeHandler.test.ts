import type { IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import { describe, expect, it, vi } from "vitest";

import { createUpgradeHandler } from "../src/createApiServer/upgradeHandler";

type RuntimeLike = {
  handleUpgrade: (request: IncomingMessage, socket: Socket, head: Buffer) => boolean;
};

describe("createUpgradeHandler", () => {
  it("destroys socket when runtime upgrade handling throws", () => {
    const runtime: RuntimeLike = {
      handleUpgrade: () => {
        throw new Error("boom");
      },
    };
    const handler = createUpgradeHandler({
      runtime: runtime as never,
      allowRemoteAccess: true,
    });
    const socket = {
      destroy: vi.fn(),
    } as unknown as Socket;

    expect(() =>
      handler(
        {
          headers: {
            host: "127.0.0.1:8787",
            origin: "http://127.0.0.1:5173",
          },
        } as IncomingMessage,
        socket,
        Buffer.alloc(0),
      ),
    ).not.toThrow();
    expect(socket.destroy).toHaveBeenCalledTimes(1);
  });
});
