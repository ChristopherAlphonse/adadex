import { useRef, useState } from "react";

type ConversationComposerProps = {
  disabled: boolean;
  disabledReason: string;
  error: string | null;
  onSend: (text: string) => Promise<boolean>;
};

export const ConversationComposer = ({
  disabled,
  disabledReason,
  error,
  onSend,
}: ConversationComposerProps) => {
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const trimmed = draft.trim();
  const canSend = !disabled && !isSending && trimmed.length > 0;

  const submit = async () => {
    if (!canSend) {
      return;
    }

    setIsSending(true);

    const ok = await onSend(trimmed);

    setIsSending(false);

    if (ok) {
      setDraft("");
    }

    inputRef.current?.focus();
  };

  return (
    <form
      className="chat-composer"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {error ? (
        <p className="chat-composer-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="chat-composer-row" data-disabled={disabled ? "true" : undefined}>
        <textarea
          aria-label="Message the agent"
          className="chat-composer-input"
          disabled={disabled}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder={disabled ? disabledReason : "Message the agent…"}
          ref={inputRef}
          rows={1}
          value={draft}
        />
        <button
          aria-label="Send message"
          className="chat-composer-send"
          disabled={!canSend}
          type="submit"
        >
          <svg
            aria-hidden="true"
            fill="none"
            focusable="false"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.2"
            viewBox="0 0 16 16"
          >
            <path d="M8 13V3" />
            <path d="M3.5 7.5L8 3l4.5 4.5" />
          </svg>
        </button>
      </div>
      <p className="chat-composer-hint">Enter to send · Shift+Enter for a new line</p>
    </form>
  );
};
