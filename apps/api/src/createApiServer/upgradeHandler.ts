import type { IncomingMessage } from "node:http";
import type { Socket } from "node:net";

import { isAllowedHostHeader, isAllowedOriginHeader, readHeaderValue } from "./security";

type TerminalRuntime = ReturnType<typeof import("../terminalRuntime").createTerminalRuntime>;

type CreateUpgradeHandlerOptions = {
  runtime: TerminalRuntime;
  allowRemoteAccess: boolean;
};

export const createUpgradeHandler = ({
  runtime,
  allowRemoteAccess,
}: CreateUpgradeHandlerOptions) => {
  return (request: IncomingMessage, socket: Socket, head: Buffer) => {
    const originHeader = readHeaderValue(request.headers.origin);
    const hostHeader = readHeaderValue(request.headers.host);
    if (!isAllowedHostHeader(hostHeader, allowRemoteAccess)) {
      socket.destroy();
      return;
    }

    if (!isAllowedOriginHeader(originHeader, allowRemoteAccess)) {
      socket.destroy();
      return;
    }

    try {
      if (!runtime.handleUpgrade(request, socket, head)) {
        socket.destroy();
      }
    } catch {
      socket.destroy();
    }
  };
};
