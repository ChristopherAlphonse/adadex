import { randomUUID } from "node:crypto";

import { logVerbose } from "../logging";
import { loadChannelMessages, persistChannelMessages } from "./channelMessageStore";
import type { ChannelMessage, PersistedTerminal, TerminalSession } from "./types";

export const createChannelMessaging = (deps: {
  terminals: Map<string, PersistedTerminal>;
  sessions: Map<string, TerminalSession>;
  writeInput: (terminalId: string, data: string) => boolean;
  messagesPath: string;
}) => {
  const { terminals, sessions, writeInput, messagesPath } = deps;
  const channelQueues = loadChannelMessages(messagesPath);
  const persist = () => persistChannelMessages(messagesPath, channelQueues);

  const deliverChannelMessages = (terminalId: string): number => {
    const queue = channelQueues.get(terminalId);

    if (!queue || queue.length === 0) {
      return 0;
    }

    const session = sessions.get(terminalId);

    if (!session) {
      return 0;
    }

    const undelivered = queue.filter((m) => !m.delivered);

    if (undelivered.length === 0) {
      return 0;
    }

    // Compose all pending messages into a single prompt injection.
    const lines = undelivered.map(
      (m) => `[Channel message from ${m.fromTerminalId}]: ${m.content}`,
    );

    const prompt = `${lines.join("\n")}\r`;

    logVerbose(`[Channel] Delivering ${undelivered.length} message(s) to ${terminalId}`);

    for (const m of undelivered) {
      m.delivered = true;
    }

    writeInput(terminalId, prompt);
    persist();

    return undelivered.length;
  };

  return {
    sendChannelMessage(
      toTerminalId: string,
      fromTerminalId: string,
      content: string,
    ): ChannelMessage | null {
      if (!terminals.has(toTerminalId)) {
        return null;
      }

      const message: ChannelMessage = {
        messageId: `msg-${randomUUID()}`,
        fromTerminalId,
        toTerminalId,
        content,
        timestamp: new Date().toISOString(),
        delivered: false,
      };

      const queue = channelQueues.get(toTerminalId) ?? [];
      queue.push(message);
      channelQueues.set(toTerminalId, queue);
      persist();

      logVerbose(
        `[Channel] Queued message ${message.messageId} from=${fromTerminalId} to=${toTerminalId}`,
      );

      // If the target session is idle, deliver immediately.
      const targetSession = sessions.get(toTerminalId);

      if (targetSession && targetSession.agentState === "idle") {
        deliverChannelMessages(toTerminalId);
      }

      return message;
    },

    listChannelMessages(terminalId: string): ChannelMessage[] {
      return channelQueues.get(terminalId) ?? [];
    },

    deliverChannelMessages,
  };
};
