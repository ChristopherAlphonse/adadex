import { type ComponentProps, useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import { useConversationChat } from "../app/hooks/useConversationChat";
import { ConversationChatThread } from "./ConversationChatThread";
import { Terminal } from "./Terminal";

type TerminalChatPaneProps = ComponentProps<typeof Terminal>;

type PaneMode = "terminal" | "chat";

const CHAT_REFRESH_MS = 3000;

const MODES: { mode: PaneMode; label: string }[] = [
  { mode: "chat", label: "Chat" },
  { mode: "terminal", label: "Terminal" },
];

const ChatView = ({ sessionId }: { sessionId: string }) => {
  const [tick, setTick] = useState(0);
  const messages = useConversationChat(sessionId, String(tick));

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((value) => value + 1);
    }, CHAT_REFRESH_MS);

    return () => {
      clearInterval(timer);
    };
  }, []);

  if (!messages || messages.length === 0) {
    return (
      <p className="m-0 p-4 text-sm text-muted-foreground">
        No chat yet. It appears after the agent finishes its first turn. Switch to Terminal to see
        what it is doing now.
      </p>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-3">
      <ConversationChatThread messages={messages} />
    </div>
  );
};

/** One agent session shown either as its raw terminal or as a structured chat, switched with a toggle. */
export const TerminalChatPane = (props: TerminalChatPaneProps) => {
  const [mode, setMode] = useState<PaneMode>("terminal");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <fieldset className="m-0 flex min-w-0 shrink-0 items-center gap-1 border-0 border-b border-border px-2 py-1">
        <legend className="sr-only">Session view</legend>
        {MODES.map((item) => (
          <button
            aria-pressed={mode === item.mode}
            className={cn(
              "rounded-md px-2.5 py-0.5 text-xs",
              mode === item.mode
                ? "bg-surface-2 font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            key={item.mode}
            onClick={() => {
              setMode(item.mode);
            }}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </fieldset>
      <div className="min-h-0 flex-1">
        {mode === "chat" ? <ChatView sessionId={props.terminalId} /> : <Terminal {...props} />}
      </div>
    </div>
  );
};
