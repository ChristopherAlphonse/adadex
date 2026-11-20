import { mkdir, rm } from "node:fs/promises";
import { createServer, type Socket } from "node:net";
import { dirname } from "node:path";
import { createInterface } from "node:readline";

export type GuardAnswer =
  | { readonly allow: true }
  | { readonly allow: false; readonly reason: string };
export type GuardDecide = (event: unknown) => Promise<GuardAnswer>;

export interface GuardHost {
  close(): Promise<void>;
}

/** Answers the hook script's questions on a local socket. A decision that throws is a "no". */
export const startGuardHost = async (
  socketPath: string,
  decide: GuardDecide,
): Promise<GuardHost> => {
  await mkdir(dirname(socketPath), { recursive: true });
  await rm(socketPath, { force: true });
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => socket.destroy());
    createInterface({ input: socket }).on("line", async (line) => {
      let answer: GuardAnswer;
      try {
        answer = await decide((JSON.parse(line) as { event: unknown }).event);
      } catch {
        answer = { allow: false, reason: "the policy could not decide" };
      }
      socket.write(`${JSON.stringify(answer)}\n`);
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, () => resolve());
  });
  return {
    async close() {
      for (const s of sockets) s.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(socketPath, { force: true });
    },
  };
};

/** The Claude Code settings that run the hook before every tool call. */
export const guardSettings = (
  hookPath: string,
  socketPath: string,
  timeoutSeconds: number,
): object => ({
  hooks: {
    PreToolUse: [
      {
        matcher: "*",
        hooks: [
          {
            type: "command",
            command: `${JSON.stringify(process.execPath)} ${JSON.stringify(hookPath)} ${JSON.stringify(socketPath)} ${timeoutSeconds}`,
            timeout: timeoutSeconds + 5,
          },
        ],
      },
    ],
  },
});
