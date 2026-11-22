import { type RefObject, useCallback, useEffect, useState } from "react";

type TextSelectionState = {
  selectedText: string;
  isSelectionBarVisible: boolean;
  dismissSelectionBar: () => void;
};

/**
 * Tracks a text selection inside a turn and exposes it to both chat render paths,
 * so quoting is always an explicit choice rather than a side effect of selecting text.
 */
export const useTextSelection = (
  containerRef: RefObject<HTMLElement | null>,
): TextSelectionState => {
  const [selectedText, setSelectedText] = useState("");
  const [isSelectionBarVisible, setIsSelectionBarVisible] = useState(false);

  useEffect(() => {
    const node = containerRef.current;

    if (!node) return undefined;

    const handleMouseUp = () => {
      const selection = window.getSelection();

      if (
        selection &&
        !selection.isCollapsed &&
        selection.toString().trim().length > 0 &&
        node.contains(selection.anchorNode)
      ) {
        setSelectedText(selection.toString());
        setIsSelectionBarVisible(true);
      }
    };

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target;

      // Clicking the bar must not unmount it before its button's click fires.
      if (target instanceof Element && target.closest('[data-selection-bar="true"]')) {
        return;
      }

      setIsSelectionBarVisible(false);
    };

    node.addEventListener("mousedown", handleMouseDown);
    node.addEventListener("mouseup", handleMouseUp);

    return () => {
      node.removeEventListener("mousedown", handleMouseDown);
      node.removeEventListener("mouseup", handleMouseUp);
    };
  }, [containerRef]);

  const dismissSelectionBar = useCallback(() => setIsSelectionBarVisible(false), []);

  return { selectedText, isSelectionBarVisible, dismissSelectionBar };
};

export const TextSelectionBar = ({
  selectedText,
  onDismiss,
  onReply,
}: {
  selectedText: string;
  onDismiss: () => void;
  onReply?: ((selectedText: string) => void) | undefined;
}) => (
  <div className="chat-selection-bar" data-selection-bar="true">
    <button
      onClick={() => {
        void navigator.clipboard.writeText(selectedText);
        onDismiss();
      }}
      type="button"
    >
      Copy
    </button>
    {onReply ? (
      <button
        onClick={() => {
          onReply(selectedText);
          onDismiss();
        }}
        type="button"
      >
        Reply
      </button>
    ) : null}
  </div>
);
