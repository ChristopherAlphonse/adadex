import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";

import { isString } from "@adadex/core";
import type { WebSocket, WebSocketServer } from "ws";

import type { AgentRuntimeState } from "../agentStateDetection";
import { getTerminalId, sendMessage } from "./protocol";
import { appendDebugLog } from "./sessionLogs";
import { toErrorMessage } from "./systemClients";
import type { TerminalSession } from "./types";

type UpgradeHandlerDeps = {
  websocketServer: WebSocketServer;
  resolveSession: (terminalId: string) => { sessionId: string; coordinationId: string } | null;
  ensureSession: (sessionId: string, coordinationId: string) => TerminalSession;
  clearIdleCloseTimer: (session: TerminalSession) => void;
  ensureAgentBootstrapped: (sessionId: string, session: TerminalSession) => void;
  sendHistory: (websocket: WebSocket, session: TerminalSession) => void;
  emitStateIfChanged: (
    session: TerminalSession,
    sessionId: string,
    nextState: AgentRuntimeState | null,
  ) => void;
  scheduleIdleCloseIfNeeded: (session: TerminalSession, sessionId: string) => void;
};

/** Accepts a browser's WebSocket for a terminal: replays its history, then relays input and resize messages. */
export const createUpgradeHandler = ({
  websocketServer,
  resolveSession,
  ensureSession,
  clearIdleCloseTimer,
  ensureAgentBootstrapped,
  sendHistory,
  emitStateIfChanged,
  scheduleIdleCloseIfNeeded,
}: UpgradeHandlerDeps) => {
  return (request: IncomingMessage, socket: Duplex, head: Buffer): boolean => {
    const terminalId = getTerminalId(request);

    if (!terminalId) {
      return false;
    }

    const resolvedSession = resolveSession(terminalId);

    if (!resolvedSession) {
      return false;
    }

    const { sessionId, coordinationId } = resolvedSession;

    websocketServer.handleUpgrade(request, socket, head, (websocket: WebSocket) => {
      let session: TerminalSession;

      try {
        session = ensureSession(sessionId, coordinationId);
      } catch (error) {
        sendMessage(websocket, {
          type: "output",
          data: `\r\n[terminal failed to start: ${toErrorMessage(error)}]\r\n`,
        });
        websocket.close();

        return;
      }

      session.clients.add(websocket);
      appendDebugLog(session, `ws-open session=${sessionId} clients=${session.clients.size}`);
      clearIdleCloseTimer(session);
      ensureAgentBootstrapped(sessionId, session);
      sendHistory(websocket, session);
      sendMessage(websocket, {
        type: "state",
        state: session.agentState,
      });

      websocket.on("message", (raw) => {
        if (session.isClosed) {
          return;
        }

        const text = isString(raw) ? raw : raw instanceof Buffer ? raw.toString() : String(raw);

        try {
          // SAFETY: websocket text is an input or resize command; the branches below
          // validate data/cols/rows before using them.
          const payload = JSON.parse(text) as
            | { type: "input"; data: string }
            | { type: "resize"; cols: number; rows: number };

          if (payload.type === "input" && isString(payload.data)) {
            appendDebugLog(
              session,
              `ws-input session=${sessionId} data=${JSON.stringify(payload.data)}`,
            );
            session.pty.write(payload.data);

            if (/[\r\n]/.test(payload.data)) {
              emitStateIfChanged(
                session,
                sessionId,
                session.stateTracker.observeSubmit(Date.now()),
              );
            }

            return;
          }

          if (
            payload.type === "resize" &&
            Number.isFinite(payload.cols) &&
            Number.isFinite(payload.rows)
          ) {
            const nextCols = Math.max(20, Math.floor(payload.cols));
            const nextRows = Math.max(10, Math.floor(payload.rows));

            if (session.cols === nextCols && session.rows === nextRows) {
              return;
            }

            session.cols = nextCols;
            session.rows = nextRows;
            session.pty.resize(nextCols, nextRows);
          }
        } catch {
          session.pty.write(text);
        }
      });

      websocket.on("close", () => {
        if (session.isClosed) {
          return;
        }

        session.clients.delete(websocket);
        appendDebugLog(session, `ws-close session=${sessionId} clients=${session.clients.size}`);
        scheduleIdleCloseIfNeeded(session, sessionId);
      });
    });

    return true;
  };
};
