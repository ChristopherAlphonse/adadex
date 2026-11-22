import { type ComponentProps, useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import { useConversationChat } from "../app/hooks/useConversationChat";
import { sendChannelMessage } from "../app/sendChannelMessage";
import { ConversationChatThread } from "./ConversationChatThread";
import { Terminal } from "./Terminal";

type TerminalChatPaneProps = ComponentProps<typeof Terminal> & {
  /** `/btw <question>` in the chat composer opens a side chat instead of messaging this session. */
  onSideChatRequest?: ((draft: string) => void) | undefined;
};

type PaneMode = "terminal" | "chat";

const CHAT_REFRESH_MS = 3000;

const MODES: { mode: PaneMode; label: string }[] = [
  { mode: "chat", label: "Chat" },
  { mode: "terminal", label: "Terminal" },
];

const ChatView = ({
  sessionId,
  onSideChatRequest,
}: {
  sessionId: string;
  onSideChatRequest?: ((draft: string) => void) | undefined;
}) => {
  const [tick, setTick] = useState(0);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const messages = useConversationChat(sessionId, String(tick));

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((value) => value + 1);
    }, CHAT_REFRESH_MS);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const send = async () => {
    const text = draft.trim();

    if (!text) return;

    if (text.startsWith("/btw ") && onSideChatRequest) {
      onSideChatRequest(text.slice(5).trim());
      setDraft("");

      return;
    }

    try {
      await sendChannelMessage(sessionId, text);
      setDraft("");
      setError(null);
    } catch {
      setError("Unable to send the message.");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {!messages || messages.length === 0 ? (
          <p className="m-0 text-sm text-muted-foreground">
            No chat yet. It appears after the agent finishes its first turn. Switch to Terminal to
            see what it is doing now.
          </p>
        ) : (
          <ConversationChatThread
            messages={messages}
            onSendAnswer={(text) => sendChannelMessage(sessionId, text)}
          />
        )}
      </div>
      <form
        className="flex shrink-0 items-center gap-2 border-t border-border px-3 py-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <input
          aria-label="Message the agent"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          placeholder="Message the agent… or /btw for a side chat"
          value={draft}
        />
        <button
          className="rounded-md bg-foreground px-2 py-1 text-sm font-medium text-background disabled:opacity-40"
          disabled={draft.trim().length === 0}
          type="submit"
        >
          Send
        </button>
      </form>
      {error ? (
        <p className="m-0 px-3 pb-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
};

/** One agent session shown either as its raw terminal or as a structured chat, switched with a toggle. */
export const TerminalChatPane = ({
  onSideChatRequest,
  ...terminalProps
}: TerminalChatPaneProps) => {
  const [chosenMode, setChosenMode] = useState<PaneMode | null>(null);
  const history = useConversationChat(terminalProps.terminalId, null);
  const mode: PaneMode = chosenMode ?? (history && history.length > 0 ? "chat" : "terminal");

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
              setChosenMode(item.mode);
            }}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </fieldset>
      <div className="min-h-0 flex-1">
        {mode === "chat" ? (
          <ChatView onSideChatRequest={onSideChatRequest} sessionId={terminalProps.terminalId} />
        ) : (
          <Terminal {...terminalProps} />
        )}
      </div>
    </div>
  );
};
