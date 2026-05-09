import type { IncomingMessage } from "node:http";

import type { WebSocket } from "ws";

import type { TerminalServerMessage, TerminalSession } from "./types";

export const getTerminalId = (request: IncomingMessage) => {
  if (!request.url) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(request.url, "http://localhost");
  } catch {
    return null;
  }

  const match = url.pathname.match(/^\/api\/terminals\/([^/]+)\/ws$/);
  if (!match) {
    return null;
  }

  try {
    return decodeURIComponent(match[1] ?? "");
  } catch {
    return null;
  }
};

export const sendMessage = (client: WebSocket, message: TerminalServerMessage) => {
  if (client.readyState !== 1) {
    return;
  }

  client.send(JSON.stringify(message));
};

export const broadcastMessage = (session: TerminalSession, message: TerminalServerMessage) => {
  for (const client of session.clients) {
    sendMessage(client, message);
  }
  for (const listener of session.directListeners) {
    listener(message);
  }
};
