import { mkdir, rm } from "node:fs/promises";
import { createServer, type Server, type Socket } from "node:net";
import { dirname } from "node:path";
import { createInterface } from "node:readline";

export interface BridgeCall {
  readonly callId: string;
  readonly actionId: string;
  readonly input: unknown;
}

export interface BridgeHost {
  /** Reply to a call. `isError` tells the agent the action did not succeed. */
  reply(callId: string, text: string, isError: boolean): void;
  close(): Promise<void>;
}

/** Listens on a local socket for the MCP bridge process and hands each call to `onCall`. Only the bridge that Claude Code spawns knows the path. */
export const startBridgeHost = async (
  socketPath: string,
  onCall: (call: BridgeCall) => void,
): Promise<BridgeHost> => {
  await mkdir(dirname(socketPath), { recursive: true });
  await rm(socketPath, { force: true });
  const sockets = new Set<Socket>();
  const owner = new Map<string, Socket>();

  const server: Server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => socket.destroy());
    createInterface({ input: socket }).on("line", (line) => {
      try {
        const call = JSON.parse(line) as BridgeCall;
        if (typeof call.callId !== "string" || typeof call.actionId !== "string") return;
        owner.set(call.callId, socket);
        onCall({ callId: call.callId, actionId: call.actionId, input: call.input });
      } catch {}
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, () => resolve());
  });

  return {
    reply(callId, text, isError) {
      const socket = owner.get(callId);
      owner.delete(callId);
      socket?.write(`${JSON.stringify({ callId, text, isError })}\n`);
    },
    async close() {
      for (const s of sockets) s.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(socketPath, { force: true });
    },
  };
};
