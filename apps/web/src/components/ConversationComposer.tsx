import { useCallback, useEffect, useRef, useState } from "react";

type ConversationComposerProps = {
  disabled: boolean;
  disabledReason: string;
  error: string | null;
  onSend: (text: string) => Promise<boolean>;
  onStop?: () => void;
  onInterruptAndSend?: (text: string) => Promise<boolean>;
  onQueue?: (text: string) => void;
  onStash?: (text: string) => void;
  externalDraft?: string;
};

export const ConversationComposer = ({
  disabled,
  disabledReason,
  error,
  onSend,
  onStop,
  onInterruptAndSend,
  onQueue,
  onStash,
  externalDraft,
}: ConversationComposerProps) => {
  const [draftState, setDraftState] = useState(() => ({
    value: externalDraft ?? "",
    external: externalDraft,
  }));

  const activeExternalDraft =
    externalDraft !== undefined && externalDraft !== draftState.external ? externalDraft : null;

  const draft = activeExternalDraft ?? draftState.value;
  const [isSending, setIsSending] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const lastEscapeTimeRef = useRef<number>(0);

  const trimmed = draft.trim();
  const canSend = !disabled && !isSending && trimmed.length > 0;

  const updateDraft = useCallback(
    (value: string) => {
      setDraftState({ value, external: externalDraft });
    },
    [externalDraft],
  );

  // Ctrl+G on window to toggle expanded mode
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === "g") {
        // Only toggle if the target is not an editable element other than our textarea
        const target = event.target;

        if (
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLInputElement ||
          target instanceof HTMLSelectElement ||
          (target instanceof HTMLElement &&
            (target.isContentEditable === true || target.contentEditable === "true"))
        ) {
          // If the target is specifically our textarea, still allow toggle
          if (target !== inputRef.current) {
            return;
          }
        }

        event.preventDefault();
        setIsExpanded((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const submit = useCallback(async () => {
    if (!canSend) {
      return;
    }

    setIsSending(true);

    const ok = await onSend(trimmed);

    setIsSending(false);

    if (ok) {
      updateDraft("");
    }

    inputRef.current?.focus();
  }, [canSend, onSend, trimmed, updateDraft]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Tab: queue message
      if (event.key === "Tab" && onQueue && trimmed.length > 0) {
        event.preventDefault();
        onQueue(trimmed);
        updateDraft("");

        return;
      }

      // Escape twice within 500ms: stop agent
      if (event.key === "Escape") {
        const now = Date.now();

        if (now - lastEscapeTimeRef.current < 500) {
          if (onStop) {
            onStop();
          }

          lastEscapeTimeRef.current = 0;
        } else {
          lastEscapeTimeRef.current = now;
        }

        return;
      }

      // Alt+S / Option+S: stash draft
      if (
        event.altKey &&
        (event.key === "s" || event.key === "S") &&
        onStash &&
        trimmed.length > 0
      ) {
        event.preventDefault();
        onStash(trimmed);
        updateDraft("");

        return;
      }

      // Ctrl+Enter or Cmd+Enter: interrupt and send
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();

        if (onInterruptAndSend && trimmed.length > 0) {
          setIsSending(true);
          void onInterruptAndSend(trimmed).then((ok) => {
            setIsSending(false);

            if (ok) {
              updateDraft("");
            }

            inputRef.current?.focus();
          });
        } else {
          void submit();
        }

        return;
      }

      // Enter (without shift, without composing): send
      if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
        event.preventDefault();
        void submit();
      }
    },
    [onQueue, onStop, onStash, onInterruptAndSend, submit, trimmed, updateDraft],
  );

  return (
    <form
      className="chat-composer"
      data-expanded={isExpanded ? "true" : undefined}
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
            updateDraft(event.target.value);
          }}
          onKeyDown={handleKeyDown}
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
      <p className="chat-composer-hint">
        Enter to send · Tab to queue · Esc×2 to stop · Shift+Enter new line
      </p>
    </form>
  );
};
