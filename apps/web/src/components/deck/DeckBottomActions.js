import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
export const DeckBottomActions = ({ onClearAll }) => {
    const [confirmingClear, setConfirmingClear] = useState(false);
    return (_jsx("div", { className: "deck-sidebar-clear", children: confirmingClear ? (_jsxs("div", { className: "deck-bottom-clear-confirm", children: [_jsx("span", { className: "deck-bottom-clear-label", children: "Clear all orchestrations?" }), _jsx("button", { type: "button", className: "deck-bottom-clear-btn deck-bottom-clear-btn--danger", onClick: () => {
                        onClearAll();
                        setConfirmingClear(false);
                    }, children: "Confirm" }), _jsx("button", { type: "button", className: "deck-bottom-clear-btn", onClick: () => setConfirmingClear(false), children: "Cancel" })] })) : (_jsxs("button", { type: "button", className: "deck-bottom-clear-link", onClick: () => setConfirmingClear(true), children: [_jsx("svg", { className: "deck-bottom-clear-icon", viewBox: "0 0 16 16", "aria-hidden": "true", children: _jsx("path", { d: "M5.5 1.5h5M2 4h12M6 7v5M10 7v5M3.5 4l.75 9.5a1 1 0 001 .9h5.5a1 1 0 001-.9L12.5 4", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round" }) }), "Clear All"] })) }));
};
