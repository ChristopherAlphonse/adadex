import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Minus, X } from "lucide-react";
import { useCallback, useState } from "react";
import { AgentStateBadge } from "../AgentStateBadge";
import { Terminal } from "../Terminal";
export const CanvasTerminalColumn = ({ node, terminals, layoutVersion, isFocused, onMinimize, onClose, onFocus, panelRef, onTerminalRenamed, onTerminalActivity, }) => {
    const [agentState, setAgentState] = useState("idle");
    const terminal = terminals.find((t) => t.terminalId === node.sessionId);
    const rawName = terminal?.coordinationName ?? node.coordinationId;
    const coordinationName = rawName.length > 24 ? `${rawName.slice(0, 24)}...` : rawName;
    const workspaceMode = terminal?.workspaceMode ?? "shared";
    const handleFocus = useCallback(() => {
        onFocus?.();
    }, [onFocus]);
    if (!node.sessionId)
        return null;
    return (_jsxs("section", { ref: panelRef, className: `canvas-terminal-column${isFocused ? " canvas-terminal-column--focused" : ""}`, tabIndex: -1, onPointerDown: handleFocus, onFocusCapture: handleFocus, children: [_jsxs("div", { className: "canvas-terminal-column-header", children: [_jsx("div", { className: "canvas-terminal-column-heading", children: _jsxs("h2", { children: [_jsx("span", { className: "canvas-terminal-column-name", children: coordinationName }), workspaceMode === "worktree" && (_jsx("span", { className: "canvas-terminal-column-badge", children: "WT" }))] }) }), _jsxs("div", { className: "canvas-terminal-column-actions", children: [_jsx("span", { className: "canvas-terminal-column-orchestration-tag", style: { background: node.color }, children: node.coordinationId }), _jsx(AgentStateBadge, { state: agentState }), _jsx("button", { type: "button", className: "canvas-terminal-column-minimize", onClick: onMinimize, "aria-label": "Minimize terminal panel", title: "Minimize terminal panel", children: _jsx(Minus, { size: 14 }) }), _jsx("button", { type: "button", className: "canvas-terminal-column-close", onClick: onClose, "aria-label": "Close terminal session", title: "Close terminal session", children: _jsx(X, { size: 14 }) })] })] }), _jsx("div", { className: "canvas-terminal-column-body", children: _jsx(Terminal, { terminalId: node.sessionId, terminalLabel: node.label, ...(layoutVersion === undefined ? {} : { layoutVersion }), onAgentRuntimeStateChange: setAgentState, ...(onTerminalRenamed ? { onTerminalRenamed } : {}), ...(onTerminalActivity ? { onTerminalActivity } : {}) }) })] }));
};
