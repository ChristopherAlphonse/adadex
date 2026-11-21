import { forwardRef, useState } from "react";

import { formatClock, toGist, toPlainText } from "../app/conversationText";
import { MarkdownContent } from "./ui/MarkdownContent";

const GIST_LENGTH = 220;

type ConversationTurnBubbleProps = {
  role: "user" | "assistant";
  content: string;
  startedAt: string;
  showSender: boolean;
  highlighted: boolean;
  highlightTerm: string | undefined;
};

export const ConversationTurnBubble = forwardRef<HTMLLIElement, ConversationTurnBubbleProps>(
  ({ role, content, startedAt, showSender, highlighted, highlightTerm }, ref) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const plain = toPlainText(content);

    const isLong =
      plain.length > GIST_LENGTH || content.length > GIST_LENGTH || content.includes("\n");

    const showFull = isExpanded || highlighted || !isLong;

    return (
      <li
        className="chat-turn"
        data-role={role}
        data-highlighted={highlighted ? "true" : undefined}
        ref={ref}
      >
        {showSender ? (
          <span className="chat-sender">{role === "user" ? "You" : "Agent"}</span>
        ) : null}
        <div className="chat-bubble">
          {showFull ? (
            <MarkdownContent
              content={content}
              className="chat-bubble-content"
              {...(highlightTerm ? { highlightTerm } : {})}
            />
          ) : (
            <p className="chat-bubble-gist">{toGist(content, GIST_LENGTH)}</p>
          )}
        </div>
        <div className="chat-meta">
          <time dateTime={startedAt}>{formatClock(startedAt)}</time>
          {isLong && !highlighted ? (
            <button
              className="chat-toggle"
              onClick={() => {
                setIsExpanded((value) => !value);
              }}
              type="button"
            >
              {isExpanded ? "Show less" : "Show full message"}
            </button>
          ) : null}
        </div>
      </li>
    );
  },
);

ConversationTurnBubble.displayName = "ConversationTurnBubble";
