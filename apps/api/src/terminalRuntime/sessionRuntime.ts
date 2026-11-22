import { existsSync } from "node:fs";

import { buildAgentLaunchCommand, isNumber, isString } from "@adadex/core";
import { type IPty, spawn } from "node-pty";
import type { WebSocket, WebSocketServer } from "ws";

import { type AgentRuntimeState, AgentStateTracker } from "../agentStateDetection";
import { claudeHookSettingsPath } from "./agentHooks";
import { stripBrokenLeadingAnsi } from "./ansiScrollback";
import {
  DEFAULT_AGENT_PROVIDER,
  TERMINAL_BOOTSTRAP_COMMANDS,
  TERMINAL_MAX_CONCURRENT_SESSIONS,
  TERMINAL_SCROLLBACK_MAX_BYTES,
  TERMINAL_SESSION_IDLE_GRACE_MS,
} from "./constants";
import {
  type ConversationTranscriptEventPayload,
  type SessionEndTranscriptEvent,
} from "./conversations";
import { broadcastMessage, sendMessage } from "./protocol";
import { createShellEnvironment, ensureNodePtySpawnHelperExecutable } from "./ptyEnvironment";
import {
  appendDebugLog,
  appendScrollback as appendScrollbackChunk,
  appendTranscriptEvent,
  closeTranscript,
  createDebugLog as openDebugLog,
  createTranscriptLog as openTranscriptLog,
  getShellLaunch,
} from "./sessionLogs";
import { createUpgradeHandler } from "./sessionSocket";
import { toErrorMessage } from "./systemClients";
import type {
  DirectSessionListener,
  PersistedTerminal,
  TerminalAgentProvider,
  TerminalSession,
  TerminalSessionEndDetails,
  TerminalSessionStartDetails,
  TerminalStateMessage,
} from "./types";

type SessionEndPayload = Extract<ConversationTranscriptEventPayload, { type: "session_end" }>;

type CreateSessionRuntimeOptions = {
  websocketServer: WebSocketServer;
  terminals: Map<string, PersistedTerminal>;
  sessions: Map<string, TerminalSession>;
  resolveTerminalSession?: (terminalId: string) => {
    sessionId: string;
    coordinationId: string;
  } | null;
  getOrchestrationWorkspaceCwd: (coordinationId: string) => string;
  isDebugPtyLogsEnabled: boolean;
  ptyLogDir: string;
  transcriptDirectoryPath: string;
  sessionIdleGraceMs?: number;
  scrollbackMaxBytes?: number;
  maxConcurrentSessions?: number;
  onStateChange?: (terminalId: string, state: AgentRuntimeState, toolName?: string) => void;
  onSessionStart?: (terminalId: string, details: TerminalSessionStartDetails) => void;
  onSessionEnd?: (terminalId: string, details: TerminalSessionEndDetails) => void;
  /** Signals the PTY's process group so descendants do not survive teardown. */
  signalGroup?: (processGroupId: number, signal: NodeJS.Signals) => void;
  onProcessSpawn?: (details: {
    processId: number;
    processGroupId: number;
    sessionId: string;
    coordinationId: string;
  }) => void;
  onProcessExit?: (sessionId: string) => void;
  /**
   * Called right before the agent CLI launches, so its hook settings exist even when `.adadex` was removed after
   * the terminal was created. Without them the session runs but never reports a chat.
   */
  prepareAgentLaunch?: (workingDirectory: string, agentProvider: TerminalAgentProvider) => void;
};

export const createSessionRuntime = ({
  websocketServer,
  terminals,
  sessions,
  resolveTerminalSession,
  getOrchestrationWorkspaceCwd,
  isDebugPtyLogsEnabled,
  ptyLogDir,
  transcriptDirectoryPath,
  sessionIdleGraceMs = TERMINAL_SESSION_IDLE_GRACE_MS,
  scrollbackMaxBytes = TERMINAL_SCROLLBACK_MAX_BYTES,
  maxConcurrentSessions = TERMINAL_MAX_CONCURRENT_SESSIONS,
  onStateChange,
  onSessionStart,
  onSessionEnd,
  signalGroup,
  onProcessSpawn,
  onProcessExit,
  prepareAgentLaunch,
}: CreateSessionRuntimeOptions) => {
  const DEFAULT_PTY_COLS = 120;
  const DEFAULT_PTY_ROWS = 35;

  const sessionLimit = Number.isFinite(maxConcurrentSessions)
    ? Math.max(1, Math.floor(maxConcurrentSessions))
    : TERMINAL_MAX_CONCURRENT_SESSIONS;

  const createDebugLog = (sessionId: string) =>
    openDebugLog(sessionId, isDebugPtyLogsEnabled, ptyLogDir);

  const createTranscriptLog = (sessionId: string) =>
    openTranscriptLog(sessionId, transcriptDirectoryPath);

  const appendScrollback = (session: TerminalSession, chunk: string) => {
    appendScrollbackChunk(session, chunk, scrollbackMaxBytes);
  };

  const emitStateIfChanged = (
    session: TerminalSession,
    sessionId: string,
    nextState: AgentRuntimeState | null,
  ) => {
    if (!nextState || nextState === session.agentState) {
      return;
    }

    session.agentState = nextState;
    appendDebugLog(session, `state-change session=${sessionId} state=${nextState}`);
    appendTranscriptEvent(session, sessionId, {
      type: "state_change",
      state: nextState,
      timestamp: new Date().toISOString(),
    });
    onStateChange?.(sessionId, nextState, session.lastToolName);
    const stateMessage: TerminalStateMessage = { type: "state", state: nextState };

    if (session.lastToolName) {
      stateMessage.toolName = session.lastToolName;
    }

    broadcastMessage(session, stateMessage);
  };

  const resolveSession =
    resolveTerminalSession ??
    ((terminalId: string) => {
      if (!terminals.has(terminalId)) {
        return null;
      }

      const terminal = terminals.get(terminalId);

      return {
        sessionId: terminalId,
        coordinationId: terminal?.coordinationId ?? terminalId,
      };
    });

  const clearIdleCloseTimer = (session: TerminalSession) => {
    if (!session.idleCloseTimer) {
      return;
    }

    clearTimeout(session.idleCloseTimer);
    session.idleCloseTimer = undefined;
  };

  const clearPromptTimers = (session: TerminalSession) => {
    if (!session.promptTimers) {
      return;
    }

    for (const timer of session.promptTimers) {
      clearTimeout(timer);
    }

    session.promptTimers.clear();
  };

  const schedulePromptTimer = (
    session: TerminalSession,
    sessionId: string,
    callback: () => void,
    delayMs: number,
  ) => {
    const timer = setTimeout(() => {
      session.promptTimers?.delete(timer);

      if (session.isClosed || sessions.get(sessionId) !== session) {
        return;
      }

      callback();
    }, delayMs);

    if (!session.promptTimers) {
      session.promptTimers = new Set();
    }

    session.promptTimers.add(timer);
  };

  const sendHistory = (websocket: WebSocket, session: TerminalSession) => {
    if (session.scrollbackChunks.length === 0) {
      return;
    }

    sendMessage(websocket, {
      type: "history",
      data: stripBrokenLeadingAnsi(session.scrollbackChunks.join("")),
    });
  };

  const teardownSession = (
    sessionId: string,
    session: TerminalSession,
    event: Omit<SessionEndTranscriptEvent, "eventId" | "sessionId" | "coordinationId">,
    options: { killPty: boolean; killSignal?: NodeJS.Signals },
  ): void => {
    if (session.isClosed) {
      return;
    }

    session.isClosed = true;
    clearIdleCloseTimer(session);
    clearPromptTimers(session);
    closeTranscript(session, sessionId, event);

    const endDetails: TerminalSessionEndDetails = {
      reason:
        event.reason === "pty_exit" ||
        event.reason === "operator_stop" ||
        event.reason === "operator_kill"
          ? event.reason
          : "session_close",
      endedAt: isString(event.timestamp) ? event.timestamp : new Date().toISOString(),
    };

    if (isNumber(event.exitCode)) {
      endDetails.exitCode = event.exitCode;
    }

    if (isNumber(event.signal) || isString(event.signal)) {
      endDetails.signal = event.signal;
    }

    onSessionEnd?.(sessionId, endDetails);

    if (session.statePollTimer) {
      clearInterval(session.statePollTimer);
      session.statePollTimer = undefined;
    }

    for (const disposable of session.ptyDisposables ?? []) {
      try {
        disposable.dispose();
      } catch {}
    }

    session.ptyDisposables = [];

    if (options.killPty) {
      const processId =
        isNumber(session.pty.pid) && Number.isInteger(session.pty.pid) && session.pty.pid > 0
          ? session.pty.pid
          : undefined;

      if (processId !== undefined) {
        try {
          signalGroup?.(processId, options.killSignal ?? "SIGKILL");
        } catch {}
      }

      try {
        session.pty.kill(options.killSignal);
      } catch {}
    }

    for (const client of session.clients) {
      if (client.readyState === 1) {
        client.close();
      }
    }

    session.clients.clear();
    session.directListeners.clear();
    session.debugLog?.end();
    session.debugLog = undefined;

    if (sessions.get(sessionId) === session) {
      sessions.delete(sessionId);
    }

    onProcessExit?.(sessionId);
  };

  const closeSession = (sessionId: string): boolean => {
    const session = sessions.get(sessionId);

    if (!session) {
      return false;
    }

    teardownSession(
      sessionId,
      session,
      {
        type: "session_end",
        reason: "session_close",
        timestamp: new Date().toISOString(),
      },
      { killPty: true },
    );

    return true;
  };

  const stopSession = (sessionId: string): boolean => {
    const session = sessions.get(sessionId);

    if (!session) {
      return false;
    }

    teardownSession(
      sessionId,
      session,
      {
        type: "session_end",
        reason: "operator_stop",
        timestamp: new Date().toISOString(),
      },
      { killPty: true },
    );

    return true;
  };

  const killSession = (sessionId: string, signal: NodeJS.Signals = "SIGKILL"): boolean => {
    const session = sessions.get(sessionId);

    if (!session) {
      return false;
    }

    teardownSession(
      sessionId,
      session,
      {
        type: "session_end",
        reason: "operator_kill",
        signal,
        timestamp: new Date().toISOString(),
      },
      { killPty: true, killSignal: signal },
    );

    return true;
  };

  const INITIAL_PROMPT_DELAY_MS = 4_000;
  const INITIAL_PROMPT_SUBMIT_DELAY_MS = 150;
  const BRACKETED_PASTE_START = "\x1b[200~";
  const BRACKETED_PASTE_END = "\x1b[201~";

  const scheduleIdleCloseIfNeeded = (session: TerminalSession, sessionId: string) => {
    if (session.isClosed || sessions.get(sessionId) !== session) {
      return;
    }

    if (session.keepAliveWithoutClients) {
      return;
    }

    if (session.clients.size > 0 || session.directListeners.size > 0) {
      return;
    }

    appendDebugLog(
      session,
      `idle-grace-start session=${sessionId} timeoutMs=${sessionIdleGraceMs}`,
    );
    clearIdleCloseTimer(session);
    session.idleCloseTimer = setTimeout(() => {
      appendDebugLog(session, `idle-grace-expired session=${sessionId}`);
      closeSession(sessionId);
    }, sessionIdleGraceMs);
  };

  const ensureAgentBootstrapped = (sessionId: string, session: TerminalSession) => {
    if (session.isBootstrapCommandSent) {
      return;
    }

    session.isBootstrapCommandSent = true;
    const terminal = terminals.get(session.terminalId);

    if (terminal?.plainShell) {
      return;
    }

    const provider = terminal?.agentProvider ?? DEFAULT_AGENT_PROVIDER;

    try {
      prepareAgentLaunch?.(session.workingDirectory, provider);
    } catch {}

    const bootstrapCommand = buildAgentLaunchCommand(
      provider,
      TERMINAL_BOOTSTRAP_COMMANDS[provider] ?? TERMINAL_BOOTSTRAP_COMMANDS[DEFAULT_AGENT_PROVIDER],
      {
        model: terminal?.agentModel,
        effort: terminal?.agentEffort,
        settingsFile: existsSync(claudeHookSettingsPath(session.workingDirectory))
          ? claudeHookSettingsPath(session.workingDirectory)
          : undefined,
      },
    );

    appendDebugLog(session, `bootstrap session=${sessionId} command=${bootstrapCommand}`);
    session.pty.write(`${bootstrapCommand}\r`);

    if (session.initialPrompt && !session.isInitialPromptSent) {
      schedulePromptTimer(
        session,
        sessionId,
        () => {
          if (session.isInitialPromptSent) {
            return;
          }

          session.isInitialPromptSent = true;
          appendDebugLog(session, `initial-prompt session=${sessionId}`);
          const prompt = session.initialPrompt ?? "";
          session.pty.write(`${BRACKETED_PASTE_START}${prompt}${BRACKETED_PASTE_END}`);
          schedulePromptTimer(
            session,
            sessionId,
            () => {
              appendDebugLog(session, `initial-prompt-submit session=${sessionId}`);
              session.pty.write("\r");
            },
            INITIAL_PROMPT_SUBMIT_DELAY_MS,
          );
        },
        INITIAL_PROMPT_DELAY_MS,
      );
    }

    if (session.initialInputDraft && !session.isInitialInputDraftSent && !session.initialPrompt) {
      schedulePromptTimer(
        session,
        sessionId,
        () => {
          if (session.isInitialInputDraftSent) {
            return;
          }

          session.isInitialInputDraftSent = true;
          appendDebugLog(session, `initial-input-draft session=${sessionId}`);
          const draft = session.initialInputDraft ?? "";
          session.pty.write(`${BRACKETED_PASTE_START}${draft}${BRACKETED_PASTE_END}`);
        },
        INITIAL_PROMPT_DELAY_MS,
      );
    }
  };

  const ensureSession = (sessionId: string, coordinationId: string) => {
    const existingSession = sessions.get(sessionId);

    if (existingSession) {
      return existingSession;
    }

    if (sessions.size >= sessionLimit) {
      throw new Error(
        `Terminal session limit reached (${sessionLimit}). Close an existing terminal session or increase ADADEX_MAX_TERMINAL_SESSIONS.`,
      );
    }

    const terminalRecord = terminals.get(sessionId);

    const orchestrationCwd = getOrchestrationWorkspaceCwd(coordinationId);

    if (!existsSync(orchestrationCwd)) {
      throw new Error(`Terminal working directory does not exist: ${orchestrationCwd}`);
    }

    ensureNodePtySpawnHelperExecutable();
    const shellLaunch = getShellLaunch();

    let pty: IPty;

    try {
      pty = spawn(shellLaunch.command, shellLaunch.args, {
        cols: DEFAULT_PTY_COLS,
        rows: DEFAULT_PTY_ROWS,
        cwd: orchestrationCwd,
        env: createShellEnvironment({ adadexSessionId: sessionId }),
        name: "xterm-256color",
      });
    } catch (error) {
      throw new Error(
        `Unable to start terminal shell (${shellLaunch.command}): ${toErrorMessage(error)}`,
      );
    }

    const stateTracker = new AgentStateTracker();
    const debugLog = createDebugLog(sessionId);
    const transcriptLog = createTranscriptLog(sessionId);

    const session: TerminalSession = {
      workingDirectory: orchestrationCwd,
      terminalId: sessionId,
      coordinationId,
      pty,
      clients: new Set(),
      directListeners: new Set(),
      cols: DEFAULT_PTY_COLS,
      rows: DEFAULT_PTY_ROWS,
      agentState: stateTracker.currentState,
      stateTracker,
      isBootstrapCommandSent: false,
      scrollbackChunks: [],
      scrollbackBytes: 0,
      transcriptEventCount: 0,
      pendingInput: "",
      hasTranscriptEnded: false,
      keepAliveWithoutClients: Boolean(terminalRecord?.initialPrompt),
    };

    if (debugLog) {
      session.debugLog = debugLog;
    }

    session.transcriptLog = transcriptLog;

    appendDebugLog(session, `session-start session=${sessionId} orchestration=${coordinationId}`);

    const processId =
      isNumber(pty.pid) && Number.isInteger(pty.pid) && pty.pid > 0 ? pty.pid : undefined;

    if (processId !== undefined) {
      onProcessSpawn?.({ processId, processGroupId: processId, sessionId, coordinationId });
    }

    const startDetails: TerminalSessionStartDetails = {
      startedAt: new Date().toISOString(),
    };

    if (processId) {
      startDetails.processId = processId;
    }

    onSessionStart?.(sessionId, startDetails);
    appendTranscriptEvent(session, sessionId, {
      type: "session_start",
      timestamp: new Date().toISOString(),
    });
    session.statePollTimer = setInterval(() => {
      emitStateIfChanged(session, sessionId, session.stateTracker.poll(Date.now()));
    }, 300);

    const dataDisposable = session.pty.onData((chunk) => {
      if (session.isClosed) {
        return;
      }

      appendDebugLog(session, `pty-output session=${sessionId} chunk=${JSON.stringify(chunk)}`);
      appendScrollback(session, chunk);
      const nextState = session.stateTracker.observeChunk(chunk, Date.now());
      broadcastMessage(session, {
        type: "output",
        data: chunk,
      });
      emitStateIfChanged(session, sessionId, nextState);
    });

    const exitDisposable = session.pty.onExit(({ exitCode, signal }) => {
      if (session.isClosed) {
        return;
      }

      const message = `\r\n[terminal exited (code ${exitCode}, signal ${signal})]\r\n`;
      broadcastMessage(session, {
        type: "output",
        data: message,
      });

      appendDebugLog(
        session,
        `session-exit session=${sessionId} code=${exitCode} signal=${signal}`,
      );

      const endEvent: SessionEndPayload = {
        type: "session_end",
        reason: "pty_exit",
        timestamp: new Date().toISOString(),
      };

      if (Number.isFinite(exitCode)) {
        endEvent.exitCode = exitCode;
      }

      if (isNumber(signal) && Number.isFinite(signal)) {
        endEvent.signal = signal;
      }

      teardownSession(sessionId, session, endEvent, { killPty: false });
    });

    session.ptyDisposables = [dataDisposable, exitDisposable];

    if (terminalRecord?.initialPrompt) {
      session.initialPrompt = terminalRecord.initialPrompt;
    }

    if (terminalRecord?.initialInputDraft) {
      session.initialInputDraft = terminalRecord.initialInputDraft;
    }

    sessions.set(sessionId, session);

    return session;
  };

  const handleUpgrade = createUpgradeHandler({
    websocketServer,
    resolveSession,
    ensureSession,
    clearIdleCloseTimer,
    ensureAgentBootstrapped,
    sendHistory,
    emitStateIfChanged,
    scheduleIdleCloseIfNeeded,
  });

  const close = () => {
    for (const sessionId of sessions.keys()) {
      closeSession(sessionId);
    }
  };

  const connectDirect = (
    terminalId: string,
    listener: DirectSessionListener,
  ): (() => void) | null => {
    const resolvedSession = resolveSession(terminalId);

    if (!resolvedSession) {
      return null;
    }

    const { sessionId, coordinationId } = resolvedSession;

    let session: TerminalSession;

    try {
      session = ensureSession(sessionId, coordinationId);
    } catch {
      return null;
    }

    session.directListeners.add(listener);
    clearIdleCloseTimer(session);
    ensureAgentBootstrapped(sessionId, session);

    if (session.scrollbackChunks.length > 0) {
      listener({ type: "history", data: session.scrollbackChunks.join("") });
    }

    listener({ type: "state", state: session.agentState });

    return () => {
      if (session.isClosed) {
        return;
      }

      session.directListeners.delete(listener);
      scheduleIdleCloseIfNeeded(session, sessionId);
    };
  };

  const startSession = (terminalId: string): boolean => {
    const resolvedSession = resolveSession(terminalId);

    if (!resolvedSession) {
      return false;
    }

    const { sessionId, coordinationId } = resolvedSession;
    let session: TerminalSession;

    try {
      session = ensureSession(sessionId, coordinationId);
    } catch {
      return false;
    }

    clearIdleCloseTimer(session);
    ensureAgentBootstrapped(sessionId, session);

    return true;
  };

  const writeInput = (terminalId: string, data: string): boolean => {
    const session = sessions.get(terminalId);

    if (!session || session.isClosed) {
      return false;
    }

    session.pty.write(data);

    if (/[\r\n]/.test(data)) {
      emitStateIfChanged(session, terminalId, session.stateTracker.observeSubmit(Date.now()));
    }

    return true;
  };

  const resizeSession = (terminalId: string, cols: number, rows: number): boolean => {
    const session = sessions.get(terminalId);

    if (!session || session.isClosed) {
      return false;
    }

    const nextCols = Math.max(20, Math.floor(cols));
    const nextRows = Math.max(10, Math.floor(rows));

    if (session.cols === nextCols && session.rows === nextRows) {
      return true;
    }

    session.cols = nextCols;
    session.rows = nextRows;
    session.pty.resize(nextCols, nextRows);

    return true;
  };

  const releaseSessionKeepAlive = (terminalId: string): boolean => {
    const session = sessions.get(terminalId);

    if (!session || session.isClosed) {
      return false;
    }

    session.keepAliveWithoutClients = false;
    scheduleIdleCloseIfNeeded(session, terminalId);

    return true;
  };

  return {
    closeSession,
    stopSession,
    killSession,
    handleUpgrade,
    connectDirect,
    startSession,
    writeInput,
    resizeSession,
    releaseSessionKeepAlive,
    close,
    getSessionCapacity: () => ({
      active: sessions.size,
      max: sessionLimit,
    }),
  };
};
