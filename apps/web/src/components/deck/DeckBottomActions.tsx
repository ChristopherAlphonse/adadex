import { useState } from "react";

// ─── Bottom actions (compact cards + clear all for populated state) ──────────

export type DeckBottomActionsProps = {
  onClearAll: () => void;
};

export const DeckBottomActions = ({ onClearAll }: DeckBottomActionsProps) => {
  const [confirmingClear, setConfirmingClear] = useState(false);

  return (
    <div className="deck-sidebar-clear">
      {confirmingClear ? (
        <div className="deck-bottom-clear-confirm">
          <span className="deck-bottom-clear-label">Clear all tentacles?</span>
          <button
            type="button"
            className="deck-bottom-clear-btn deck-bottom-clear-btn--danger"
            onClick={() => {
              onClearAll();
              setConfirmingClear(false);
            }}
          >
            Confirm
          </button>
          <button
            type="button"
            className="deck-bottom-clear-btn"
            onClick={() => setConfirmingClear(false)}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="deck-bottom-clear-link"
          onClick={() => setConfirmingClear(true)}
        >
          <svg className="deck-bottom-clear-icon" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M5.5 1.5h5M2 4h12M6 7v5M10 7v5M3.5 4l.75 9.5a1 1 0 001 .9h5.5a1 1 0 001-.9L12.5 4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Clear All
        </button>
      )}
    </div>
  );
};
