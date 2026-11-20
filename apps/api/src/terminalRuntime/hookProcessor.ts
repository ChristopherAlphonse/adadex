import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { type ParsedRecord, asRecord, isParsedRecord, isString } from "@adadex/core";

import { logVerbose } from "../logging";
import { parseAgentTranscript } from "./agentTranscript";
import { storeAgentTranscriptTurns } from "./conversations";
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

  const parseHookFile = (fileContents: string): { hooks: unknown[] } | null => {
    try {
      const parsed: unknown = JSON.parse(fileContents);
      const record = asRecord(parsed);

      if (!record) {
        return null;
      }

      return { hooks: Array.isArray(record.hooks) ? record.hooks : [] };
    } catch {
      return null;
    }
  };

  const mergeHookList = (existingHooks: unknown[], nextHooks: unknown[]): unknown[] => {
    const merged = [...existingHooks];

    for (const nextHook of nextHooks) {
      const serializedNextHook = JSON.stringify(nextHook);

      const alreadyPresent = existingHooks.some(
        (existingHook) => JSON.stringify(existingHook) === serializedNextHook,
      );

      if (!alreadyPresent) {
        merged.push(nextHook);
      }
    }

    return merged;
  };

  // Claude Code reads hooks from .claude/settings.local.json (git-ignored by default),
  // grouped by event, with its own tool names (Write/Edit instead of fs_write).
  const installClaudeHooks = (
    targetCwd: string,
    kiroHooks: Array<{
      name: string;
      trigger: string;
      matcher: string;
      action: { command: string };
      timeout: number;
    }>,
  ) => {
    const dir = join(targetCwd, ".claude");
    const file = join(dir, "settings.local.json");

    try {
      mkdirSync(dir, { recursive: true });

      const settings: ParsedRecord = existsSync(file)
        ? (asRecord(JSON.parse(readFileSync(file, "utf8"))) ?? {})
        : {};

      const hooks: ParsedRecord = isParsedRecord(settings.hooks) ? settings.hooks : {};

      for (const hook of kiroHooks) {
        const existingGroups = hooks[hook.trigger];

        const groups = Array.isArray(existingGroups)
          ? existingGroups.filter(
              (g) => !JSON.stringify(g).includes(`"${hook.action.command.replace(/"/g, '\\"')}"`),
            )
          : [];

        groups.push({
          matcher: hook.matcher === "fs_write" ? "Write|Edit|MultiEdit" : hook.matcher,
          hooks: [{ type: "command", command: hook.action.command, timeout: hook.timeout }],
        });
        hooks[hook.trigger] = groups;
      }

      writeFileSync(file, `${JSON.stringify({ ...settings, hooks }, null, 2)}\n`, "utf8");
    } catch {}
  };

  const installHooksInDirectory = (targetCwd: string, agentProvider = "kiro") => {
    const targetKiroHooksDir = join(targetCwd, ".kiro", "hooks");
    const targetHookFilePath = join(targetKiroHooksDir, "adadex.json");
    const apiBaseUrl = getApiBaseUrl();

    const nextHooks = [
      {
        name: "adadex-session-start",
        trigger: "SessionStart",
        matcher: "*",
        action: {
          type: "command",
          command: `curl -s -X POST "${apiBaseUrl}/api/hooks/session-start?adadex_session=$ADADEX_SESSION_ID" -H 'Content-Type: application/json' -d @- || true`,
        },
        timeout: 5,
      },
      {
        name: "adadex-user-prompt-submit",
        trigger: "UserPromptSubmit",
        matcher: "*",
        action: {
          type: "command",
          command: `curl -s -X POST "${apiBaseUrl}/api/hooks/user-prompt-submit?adadex_session=$ADADEX_SESSION_ID" -H 'Content-Type: application/json' -d @- || true`,
        },
        timeout: 5,
      },
      {
        name: "adadex-pre-tool-use",
        trigger: "PreToolUse",
        matcher: "*",
        action: {
          type: "command",
          // ponytail: PreToolUse is fail-closed in Kiro (a non-zero exit blocks the tool
          // call), so we force `exit 0` even on curl failure — this trades hook-delivery
          // reliability for not blocking every tool call on a transient curl hiccup.
          // Upgrade path: a local queue/retry if false negatives from the API being down
          // become a problem.
          command: `curl -s -X POST "${apiBaseUrl}/api/hooks/pre-tool-use?adadex_session=$ADADEX_SESSION_ID" -H 'Content-Type: application/json' -d @- ; exit 0`,
        },
        timeout: 5,
      },
      {
        name: "adadex-post-tool-use",
        trigger: "PostToolUse",
        matcher: "fs_write",
        action: {
          type: "command",
          command: `curl -s -X POST "${apiBaseUrl}/api/code-intel/events?adadex_session=$ADADEX_SESSION_ID" -H 'Content-Type: application/json' -d @- || true`,
        },
        timeout: 5,
      },
      // Note: Kiro has no Notification trigger today, so permission/idle-prompt
      // detection (previously driven by the "notification" hook) is unavailable.
      {
        name: "adadex-stop",
        trigger: "Stop",
        matcher: "*",
        action: {
          type: "command",
          command: `curl -s -X POST "${apiBaseUrl}/api/hooks/stop?adadex_session=$ADADEX_SESSION_ID" -H 'Content-Type: application/json' -d @- || true`,
        },
        timeout: 15,
      },
    ];

    if (agentProvider === "claude") {
      installClaudeHooks(targetCwd, nextHooks);

      return;
    }

    if (agentProvider !== "kiro") {
      // OpenCode has no shell hooks.
      return;
    }

    try {
      mkdirSync(targetKiroHooksDir, { recursive: true });

      const existingFile = existsSync(targetHookFilePath)
        ? parseHookFile(readFileSync(targetHookFilePath, "utf8"))
        : null;

      const existingHooks = existingFile?.hooks ?? [];
      const mergedHooks = mergeHookList(existingHooks, nextHooks);

      const document = { version: "v1", hooks: mergedHooks };
      writeFileSync(targetHookFilePath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
    } catch {
      // Best-effort
    }
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

    const hookCwd = isString(hookPayloadRecord.cwd) ? hookPayloadRecord.cwd : null;

    logVerbose(`[Hook] Stop hook: transcriptPath=${transcriptPath}, hookCwd=${hookCwd}`);

    if (!transcriptPath || !hookCwd) {
      logVerbose("[Hook] Missing transcriptPath or hookCwd, skipping.");

      return { ok: true };
    }

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
    const turns = parseAgentTranscript(transcriptPath);
    logVerbose(`[Hook] Parsed ${turns?.length ?? 0} turns from transcript.`);

    const lastAssistantMessage = isString(hookPayloadRecord.last_assistant_message)
      ? hookPayloadRecord.last_assistant_message.trim()
      : null;

    if (lastAssistantMessage && lastAssistantMessage.length > 0) {
      const effectiveTurns = turns ?? [];
      const lastTurn = effectiveTurns.length > 0 ? effectiveTurns[effectiveTurns.length - 1] : null;

      if (lastTurn?.role !== "assistant" || lastTurn.content !== lastAssistantMessage) {
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

      if (effectiveTurns.length > 0) {
        storeAgentTranscriptTurns(transcriptDirectoryPath, matchedSessionId, effectiveTurns);
        logVerbose(`[Hook] Stored ${effectiveTurns.length} turns for session ${matchedSessionId}.`);
      }
    } else if (turns && turns.length > 0) {
      storeAgentTranscriptTurns(transcriptDirectoryPath, matchedSessionId, turns);
      logVerbose(`[Hook] Stored ${turns.length} turns for session ${matchedSessionId}.`);
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
