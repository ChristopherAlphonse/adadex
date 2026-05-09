declare module "ws" {
  import type { EventEmitter } from "node:events";
  import type { IncomingMessage } from "node:http";
  import type { Duplex } from "node:stream";

  type WebSocketData = string | Buffer | ArrayBuffer | Buffer[];

  export interface WebSocket extends EventEmitter {
    readonly readyState: number;
    send(data: string | Buffer): void;
    close(): void;
    on(event: "message", listener: (data: WebSocketData) => void): this;
    on(event: "close", listener: () => void): this;
  }

  type HandleUpgradeCallback = (websocket: WebSocket) => void;

  export class WebSocketServer extends EventEmitter {
    constructor(options: { noServer: true });
    handleUpgrade(
      request: IncomingMessage,
      socket: Duplex,
      head: Buffer,
      callback: HandleUpgradeCallback,
    ): void;
    close(): void;
  }
}
