import { mkdir, rm } from "node:fs/promises";
import { createServer, type Socket } from "node:net";
import { dirname } from "node:path";
import { createInterface } from "node:readline";

import { isParsedRecord, type ParsedRecord, type ParsedValue } from "@adadex/core";

export type GuardAnswer =
  | { readonly allow: true }
  | { readonly allow: false; readonly reason: string };

/** A tool call from the external hook. Fields stay unparsed until the policy reads them. */
export type GuardEvent = ParsedRecord;

export type GuardDecide = (event: GuardEvent) => Promise<GuardAnswer>;

export interface GuardHost {
  close(): Promise<void>;
}

/** Shape of the hook settings written into a Claude Code settings file. */
export interface GuardSettings {
  hooks: {
    PreToolUse: {
      matcher: string;
      hooks: { type: string; command: string; timeout: number }[];
    }[];
  };
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
        const payload: ParsedValue = JSON.parse(line);
        const envelope = isParsedRecord(payload) ? payload : {};
        const candidate = envelope.event;
        answer = await decide(isParsedRecord(candidate) ? candidate : {});
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
): GuardSettings => ({
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
