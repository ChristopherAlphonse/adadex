declare module "ws" {
  import type { IncomingMessage } from "node:http";
  import type { Socket } from "node:net";

  export class WebSocket {
    static OPEN: number;
    readonly readyState: number;
    close(code?: number, reason?: string): void;
    on(event: "close", listener: () => void): this;
    on(event: "message", listener: (data: { toString: () => string }) => void): this;
    send(data: string): void;
  }

  export class WebSocketServer {
    constructor(options: { noServer?: boolean });
    handleUpgrade(
      request: IncomingMessage,
      socket: Socket,
      head: Buffer,
      callback: (websocket: WebSocket) => void,
    ): void;
  }
}
