import { type TerminalAgentProvider, asRecord, isString } from "@adadex/core";

import { logVerbose } from "../logging";
import { installAgentHooks } from "./agentHooks";
import { parseAgentTranscript } from "./agentTranscript";
import { appendAgentTranscriptTurn, storeAgentTranscriptTurns } from "./conversations";
import { broadcastMessage } from "./protocol";
import type { PersistedTerminal, TerminalSession, TerminalStateMessage } from "./types";

const MAX_AUTO_NAME_LENGTH = 50;

const deriveTerminalNameFromPrompt = (prompt: string): string => {
  const normalized = prompt.replace(/\s+/g, " ").trim();

  if (normalized.length <= MAX_AUTO_NAME_LENGTH) {
    return normalized;
  }

  // Truncate at the last space before the limit to avoid cutting mid-word.
  const truncated = normalized.slice(0, MAX_AUTO_NAME_LENGTH);
  const lastSpace = truncated.lastIndexOf(" ");

  return lastSpace > 0 ? `${truncated.slice(0, lastSpace)}…` : `${truncated}…`;
};

export const createHookProcessor = (deps: {
  terminals: Map<string, PersistedTerminal>;
  sessions: Map<string, TerminalSession>;
  transcriptDirectoryPath: string;
  getApiBaseUrl: () => string;
  persistRegistry: () => void;
  deliverChannelMessages: (terminalId: string) => number;
  releaseSessionKeepAlive: (terminalId: string) => boolean;
  onStateChange?: (
    terminalId: string,
    state: TerminalSession["agentState"],
    toolName?: string,
  ) => void;
}) => {
  const {
    terminals,
    sessions,
    transcriptDirectoryPath,
    getApiBaseUrl,
    persistRegistry,
    deliverChannelMessages,
    releaseSessionKeepAlive,
    onStateChange,
  } = deps;

  const installHooksInDirectory = (targetCwd: string, agentProvider: TerminalAgentProvider) => {
    installAgentHooks(targetCwd, agentProvider, getApiBaseUrl());
  };

  const handleHook = <T>(hookName: string, payload: T, hookSessionId?: string) => {
    logVerbose(`[Hook] Received hook: ${hookName} session=${hookSessionId ?? "(none)"}`);

    const hookPayloadRecord = asRecord(payload);

    if (!hookPayloadRecord) {
      return { ok: true };
    }

    if (hookName === "notification") {
      if (!hookSessionId) {
        return { ok: true };
      }

      const session = sessions.get(hookSessionId);

      if (!session) {
        logVerbose(`[Hook] notification: no session for ${hookSessionId}, skipping.`);

        return { ok: true };
      }

      const notificationType = isString(hookPayloadRecord.notification_type)
        ? hookPayloadRecord.notification_type
        : null;

      logVerbose(`[Hook] notification: type=${notificationType} session=${hookSessionId}`);

      if (notificationType === "permission_prompt") {
        session.agentState = "waiting_for_permission";
        session.stateTracker.forceState("waiting_for_permission");
        onStateChange?.(hookSessionId, "waiting_for_permission", session.lastToolName);

        const permissionMessage: TerminalStateMessage = {
          type: "state",
          state: "waiting_for_permission",
        };

        if (session.lastToolName) {
          permissionMessage.toolName = session.lastToolName;
        }

        broadcastMessage(session, permissionMessage);
      } else if (notificationType === "idle_prompt") {
        session.agentState = "idle";
        session.stateTracker.forceState("idle");
        onStateChange?.(hookSessionId, "idle");
        broadcastMessage(session, { type: "state", state: "idle" });

        // Deliver any queued channel messages now that the agent is idle.
        deliverChannelMessages(hookSessionId);
      }

      return { ok: true };
    }

    if (hookName === "pre-tool-use") {
      if (!hookSessionId) {
        return { ok: true };
      }

      const session = sessions.get(hookSessionId);

      if (!session) {
        return { ok: true };
      }

      const toolName = isString(hookPayloadRecord.tool_name) ? hookPayloadRecord.tool_name : null;

      logVerbose(`[Hook] pre-tool-use: tool=${toolName} session=${hookSessionId}`);

      if (toolName) {
        session.lastToolName = toolName;
      }

      if (toolName === "AskUserQuestion") {
        session.agentState = "waiting_for_user";
        session.stateTracker.forceState("waiting_for_user");
        onStateChange?.(hookSessionId, "waiting_for_user");
        broadcastMessage(session, { type: "state", state: "waiting_for_user" });
      }

      return { ok: true };
    }

    if (hookName === "user-prompt-submit") {
      if (!hookSessionId) {
        return { ok: true };
      }

      const terminal = terminals.get(hookSessionId);

      if (!terminal) {
        return { ok: true };
      }

      // Update last-active timestamp (determines active/inactive on the canvas).
      terminal.lastActiveAt = new Date().toISOString();

      // The user submitted a prompt, so the agent is about to start processing.
      // Transition state out of waiting/idle to processing immediately.
      const activitySession = sessions.get(terminal.terminalId);

      if (activitySession) {
        activitySession.agentState = "processing";
        activitySession.lastToolName = undefined;
        activitySession.stateTracker.forceState("processing");
        onStateChange?.(terminal.terminalId, "processing");
        broadcastMessage(activitySession, { type: "state", state: "processing" });
        broadcastMessage(activitySession, { type: "activity" });
      }

      // Keep the operator's message as a conversation turn, even if the agent's transcript file
      // cannot be read later on.
      const submittedPrompt = isString(hookPayloadRecord.prompt)
        ? hookPayloadRecord.prompt.trim()
        : "";

      if (submittedPrompt.length > 0) {
        appendAgentTranscriptTurn(
          transcriptDirectoryPath,
          terminal.terminalId,
          "user",
          submittedPrompt,
        );
      }

      // Auto-name the terminal from the first prompt when it still has its default name.
      if (terminal.nameOrigin === "generated") {
        const prompt = isString(hookPayloadRecord.prompt) ? hookPayloadRecord.prompt.trim() : "";

        const renameContext = terminal.autoRenamePromptContext?.trim() || prompt;

        if (renameContext.length > 0) {
          const derived = deriveTerminalNameFromPrompt(renameContext);
          terminal.coordinationName = derived;
          terminal.nameOrigin = "prompt";
          terminal.autoRenamePromptContext = undefined;
          logVerbose(`[Hook] Auto-named terminal ${terminal.terminalId} → "${derived}"`);

          const session = sessions.get(terminal.terminalId);

          if (session) {
            broadcastMessage(session, { type: "rename", coordinationName: derived });
          }
        }
      }

      persistRegistry();

      return { ok: true };
    }

    if (hookName !== "stop") {
      return { ok: true };
    }

    const transcriptPath = isString(hookPayloadRecord.transcript_path)
      ? hookPayloadRecord.transcript_path
      : null;

    logVerbose(`[Hook] Stop hook: transcriptPath=${transcriptPath}`);

    let matchedSessionId: string | null = null;

    if (hookSessionId && sessions.has(hookSessionId)) {
      matchedSessionId = hookSessionId;
      logVerbose(`[Hook] Matched session by hook session id: ${matchedSessionId}`);
    } else if (hookSessionId) {
      logVerbose(`[Hook] hook session id=${hookSessionId} not found in active sessions, skipping.`);

      return { ok: true };
    } else {
      logVerbose("[Hook] No session id header/query — ignoring hook from external agent session.");

      return { ok: true };
    }

    logVerbose(`[Hook] Matched session: ${matchedSessionId}, parsing transcript...`);
    // OpenCode has no transcript file; its stop still ends the turn and delivers queued messages.
    const turns = transcriptPath ? parseAgentTranscript(transcriptPath) : null;
    logVerbose(`[Hook] Parsed ${turns?.length ?? 0} turns from transcript.`);

    const lastAssistantMessage = isString(hookPayloadRecord.last_assistant_message)
      ? hookPayloadRecord.last_assistant_message.trim()
      : null;

    if (turns && turns.length > 0) {
      // The agent's own transcript is the full record, so it replaces what was stored so far.
      const effectiveTurns = [...turns];
      const lastTurn = effectiveTurns[effectiveTurns.length - 1];

      if (
        lastAssistantMessage &&
        lastAssistantMessage.length > 0 &&
        (lastTurn?.role !== "assistant" || lastTurn.content !== lastAssistantMessage)
      ) {
        const now = new Date().toISOString();
        effectiveTurns.push({
          turnId: `turn-${effectiveTurns.length + 1}`,
          role: "assistant",
          content: lastAssistantMessage,
          startedAt: now,
          endedAt: now,
        });
        logVerbose("[Hook] Appended last_assistant_message as final turn.");
      }

      storeAgentTranscriptTurns(transcriptDirectoryPath, matchedSessionId, effectiveTurns);
      logVerbose(`[Hook] Stored ${effectiveTurns.length} turns for session ${matchedSessionId}.`);
    } else if (lastAssistantMessage && lastAssistantMessage.length > 0) {
      // No readable transcript: add the reply after the prompts already recorded for this session.
      appendAgentTranscriptTurn(
        transcriptDirectoryPath,
        matchedSessionId,
        "assistant",
        lastAssistantMessage,
      );
      logVerbose(`[Hook] Appended last_assistant_message for session ${matchedSessionId}.`);
    }

    // Deliver any queued channel messages now that the agent is idle.
    if (matchedSessionId) {
      const deliveredMessageCount = deliverChannelMessages(matchedSessionId);

      if (deliveredMessageCount === 0) {
        releaseSessionKeepAlive(matchedSessionId);
      }
    }

    return { ok: true };
  };

  return { handleHook, installHooksInDirectory };
};
