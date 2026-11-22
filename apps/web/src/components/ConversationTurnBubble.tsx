import { forwardRef, useCallback, useEffect, useRef, useState } from "react";

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
  turnId?: string | undefined;
  onRewind?: ((turnId: string) => void) | undefined;
  onFork?: ((turnId: string) => void) | undefined;
  onReply?: ((selectedText: string) => void) | undefined;
};

export const ConversationTurnBubble = forwardRef<HTMLLIElement, ConversationTurnBubbleProps>(
  (
    {
      role,
      content,
      startedAt,
      showSender,
      highlighted,
      highlightTerm,
      turnId,
      onRewind,
      onFork,
      onReply,
    },
    ref,
  ) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isSelectionBarVisible, setIsSelectionBarVisible] = useState(false);
    const [selectionBarText, setSelectionBarText] = useState("");

    const plain = toPlainText(content);

    const isLong =
      plain.length > GIST_LENGTH || content.length > GIST_LENGTH || content.includes("\n");

    const showFull = isExpanded || highlighted || !isLong;

    const liRef = useRef<HTMLLIElement | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);

    // Merge forwarded ref with local liRef
    const setRef = useCallback(
      (node: HTMLLIElement | null) => {
        liRef.current = node;

        if (ref && "current" in ref) {
          ref.current = node;
        } else if (ref) {
          ref(node);
        }
      },
      [ref],
    );

    // Close menu when clicking outside
    useEffect(() => {
      if (!isMenuOpen) return;

      const handleMouseDown = (event: MouseEvent) => {
        // SAFETY: a mousedown target is always a DOM Node.
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
          setIsMenuOpen(false);
        }
      };

      document.addEventListener("mousedown", handleMouseDown);

      return () => {
        document.removeEventListener("mousedown", handleMouseDown);
      };
    }, [isMenuOpen]);

    const handleCopyMessage = () => {
      void navigator.clipboard.writeText(toPlainText(content));
      setIsMenuOpen(false);
    };

    const handleSaveAsMarkdown = () => {
      const blob = new Blob([content], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `turn-${turnId ?? "unknown"}.md`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setIsMenuOpen(false);
    };

    const handleRewind = () => {
      if (onRewind && turnId) {
        onRewind(turnId);
      }

      setIsMenuOpen(false);
    };

    const handleFork = () => {
      if (onFork && turnId) {
        onFork(turnId);
      }

      setIsMenuOpen(false);
    };

    useEffect(() => {
      const node = liRef.current;

      if (!node) return undefined;

      const handleSelectionMouseUp = () => {
        const selection = window.getSelection();

        if (
          selection &&
          !selection.isCollapsed &&
          selection.toString().trim().length > 0 &&
          node.contains(selection.anchorNode)
        ) {
          setSelectionBarText(selection.toString());
          setIsSelectionBarVisible(true);
        }
      };

      const handleSelectionMouseDown = () => {
        setIsSelectionBarVisible(false);
      };

      node.addEventListener("mousedown", handleSelectionMouseDown);
      node.addEventListener("mouseup", handleSelectionMouseUp);

      return () => {
        node.removeEventListener("mousedown", handleSelectionMouseDown);
        node.removeEventListener("mouseup", handleSelectionMouseUp);
      };
    }, []);

    const handleCopySelection = () => {
      void navigator.clipboard.writeText(selectionBarText);
      setIsSelectionBarVisible(false);
    };

    const handleReplySelection = () => {
      if (onReply) {
        onReply(selectionBarText);
      }

      setIsSelectionBarVisible(false);
    };

    return (
      <li
        className="chat-turn"
        data-role={role}
        data-highlighted={highlighted ? "true" : undefined}
        ref={setRef}
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

        {/* Per-message action menu trigger */}
        <button
          type="button"
          className="chat-turn-menu-trigger"
          aria-label="Message actions"
          aria-expanded={isMenuOpen ? "true" : undefined}
          onClick={() => setIsMenuOpen((v) => !v)}
        >
          ⋯
        </button>

        {/* Per-message action menu */}
        {isMenuOpen ? (
          <div role="menu" className="chat-turn-menu" ref={menuRef}>
            <button type="button" onClick={handleCopyMessage}>
              Copy
            </button>
            <button type="button" onClick={handleSaveAsMarkdown}>
              Save as Markdown
            </button>
            {role === "user" && onRewind ? (
              <button type="button" onClick={handleRewind}>
                Rewind to here
              </button>
            ) : null}
            {role === "assistant" && onFork ? (
              <button type="button" onClick={handleFork}>
                Fork from here
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Text selection bar */}
        {isSelectionBarVisible ? (
          <div className="chat-selection-bar">
            <button type="button" onClick={handleCopySelection}>
              Copy
            </button>
            {onReply ? (
              <button type="button" onClick={handleReplySelection}>
                Reply
              </button>
            ) : null}
          </div>
        ) : null}
      </li>
    );
  },
);

ConversationTurnBubble.displayName = "ConversationTurnBubble";
