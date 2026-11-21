import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  CHANNEL_MESSAGES_VERSION,
  loadChannelMessages,
  persistChannelMessages,
} from "../src/terminalRuntime/channelMessageStore";
import type { ChannelMessage } from "../src/terminalRuntime/types";

const message = (overrides: Partial<ChannelMessage> = {}): ChannelMessage => ({
  messageId: "msg-1",
  fromTerminalId: "agent-1",
  toTerminalId: "agent-2",
  content: "please review",
  timestamp: "2026-11-19T12:00:00.000Z",
  delivered: false,
  ...overrides,
});

describe("channel message persistence", () => {
  const temporaryDirectories: string[] = [];

  const storePath = () => {
    const directory = mkdtempSync(join(tmpdir(), "adadex-channel-store-test-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "state", "channel-messages.json");
    mkdirSync(dirname(path), { recursive: true });

    return path;
  };

  afterEach(() => {
    for (const directory of temporaryDirectories) {
      rmSync(directory, { recursive: true, force: true });
    }

    temporaryDirectories.length = 0;
  });

  it("round-trips queued and delivered messages grouped by recipient", () => {
    const path = storePath();

    const queues = new Map<string, ChannelMessage[]>([
      [
        "agent-2",
        [
          message(),
          message({
            messageId: "msg-2",
            content: "second",
            delivered: true,
          }),
        ],
      ],
      ["agent-3", [message({ messageId: "msg-3", toTerminalId: "agent-3" })]],
    ]);

    persistChannelMessages(path, queues);
    const loaded = loadChannelMessages(path);

    expect([...loaded.keys()]).toEqual(["agent-2", "agent-3"]);
    expect(loaded.get("agent-2")).toEqual(queues.get("agent-2"));
    expect(loaded.get("agent-3")).toEqual(queues.get("agent-3"));

    const document =
      /* SAFETY: preceding checks establish the invariant this assertion encodes. */ JSON.parse(
        readFileSync(path, "utf8"),
      ) as {
        version: number;
        messages: ChannelMessage[];
      };

    expect(document.version).toBe(CHANNEL_MESSAGES_VERSION);
    expect(document.messages).toHaveLength(3);
  });

  it("returns empty queues for a missing or corrupt file", () => {
    const path = storePath();
    expect([...loadChannelMessages(path)]).toEqual([]);

    writeFileSync(path, "{ not json", "utf8");
    expect([...loadChannelMessages(path)]).toEqual([]);
  });

  it("keeps valid messages when a record is malformed", () => {
    const path = storePath();
    writeFileSync(
      path,
      `${JSON.stringify({
        version: CHANNEL_MESSAGES_VERSION,
        messages: [
          message(),
          { messageId: "broken", toTerminalId: "agent-2" },
          message({ messageId: "msg-4", delivered: true }),
        ],
      })}\n`,
      "utf8",
    );

    const loaded = loadChannelMessages(path);
    expect(loaded.get("agent-2")?.map((entry) => entry.messageId)).toEqual(["msg-1", "msg-4"]);
  });
});
