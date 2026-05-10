import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Terminal, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { buildDeckTodoAddUrl, buildDeckTodoDeleteUrl, buildDeckTodoEditUrl, buildDeckTodoSolveUrl, buildDeckTodoToggleUrl, } from "../../runtime/runtimeEndpoints";
import { MascotGlyph } from "../MascotSprite";
import { deriveMascotVisuals } from "../deck/mascotVisuals";
const STATUS_LABELS = {
    idle: "idle",
    active: "active",
    blocked: "blocked",
    "needs-review": "review",
};
const formatTime = (isoString) => {
    if (!isoString)
        return "—";
    const d = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1)
        return "just now";
    if (diffMin < 60)
        return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24)
        return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
};
export const CanvasOrchestrationPanel = ({ node, isFocused, onClose, onFocus, panelRef, orchestration, sessions, onCreateAgent, onSolveTodoItem, onSpawnSwarm, onNavigateToConversation, onRefreshOrchestrationData, }) => {
    const visuals = useMemo(() => (orchestration ? deriveMascotVisuals(orchestration) : null), [orchestration]);
    const [editingIndex, setEditingIndex] = useState(null);
    const [editText, setEditText] = useState("");
    const [addingTodo, setAddingTodo] = useState(false);
    const [addText, setAddText] = useState("");
    const [solvingTodoIndex, setSolvingTodoIndex] = useState(null);
    const [spawningSwarmMode, setSpawningSwarmMode] = useState(null);
    const [spawnSwarmError, setSpawnSwarmError] = useState(null);
    const refreshOrchestrationData = useCallback(async () => {
        await onRefreshOrchestrationData?.();
    }, [onRefreshOrchestrationData]);
    const handleSpawnSwarm = useCallback(async (workspaceMode) => {
        try {
            setSpawnSwarmError(null);
            setSpawningSwarmMode(workspaceMode);
            await onSpawnSwarm?.(node.coordinationId, workspaceMode);
        }
        catch (error) {
            setSpawnSwarmError(error instanceof Error ? error.message : "Failed to spawn swarm.");
        }
        finally {
            setSpawningSwarmMode((current) => (current === workspaceMode ? null : current));
        }
    }, [node.coordinationId, onSpawnSwarm]);
    const handleTodoToggle = useCallback(async (itemIndex, done) => {
        try {
            const response = await fetch(buildDeckTodoToggleUrl(node.coordinationId), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ itemIndex, done }),
            });
            if (!response.ok)
                return;
            await refreshOrchestrationData();
        }
        catch {
            // silent
        }
    }, [node.coordinationId, refreshOrchestrationData]);
    const handleTodoEdit = useCallback(async (itemIndex, text) => {
        if (text.trim().length === 0)
            return;
        try {
            const response = await fetch(buildDeckTodoEditUrl(node.coordinationId), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ itemIndex, text: text.trim() }),
            });
            if (!response.ok)
                return;
            setEditingIndex(null);
            await refreshOrchestrationData();
        }
        catch {
            // silent
        }
    }, [node.coordinationId, refreshOrchestrationData]);
    const handleTodoAdd = useCallback(async (text) => {
        if (text.trim().length === 0)
            return;
        try {
            const response = await fetch(buildDeckTodoAddUrl(node.coordinationId), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: text.trim() }),
            });
            if (!response.ok)
                return;
            setAddingTodo(false);
            setAddText("");
            await refreshOrchestrationData();
        }
        catch {
            // silent
        }
    }, [node.coordinationId, refreshOrchestrationData]);
    const handleTodoDelete = useCallback(async (itemIndex) => {
        try {
            const response = await fetch(buildDeckTodoDeleteUrl(node.coordinationId), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ itemIndex }),
            });
            if (!response.ok)
                return;
            await refreshOrchestrationData();
        }
        catch {
            // silent
        }
    }, [node.coordinationId, refreshOrchestrationData]);
    const handleTodoSolve = useCallback(async (itemIndex) => {
        try {
            setSolvingTodoIndex(itemIndex);
            const response = await fetch(buildDeckTodoSolveUrl(node.coordinationId), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ itemIndex }),
            });
            if (!response.ok)
                return;
            onSolveTodoItem?.(node.coordinationId, itemIndex);
        }
        catch {
            // silent
        }
        finally {
            setSolvingTodoIndex((current) => (current === itemIndex ? null : current));
        }
    }, [node.coordinationId, onSolveTodoItem]);
    const progressPct = orchestration && orchestration.todoTotal > 0
        ? Math.round((orchestration.todoDone / orchestration.todoTotal) * 100)
        : 0;
    return (_jsxs("div", { ref: panelRef, className: `detail-panel${isFocused ? " detail-panel--focused" : ""}`, tabIndex: -1, onPointerDown: () => onFocus?.(), children: [_jsxs("div", { className: "detail-panel-header", style: {
                    background: `linear-gradient(180deg, color-mix(in srgb, ${node.color ?? "var(--accent-primary)"} 90%, #ffd89d 10%) 0%, color-mix(in srgb, ${node.color ?? "var(--accent-primary)"} 78%, #d9851c 22%) 100%)`,
                }, children: [_jsx("span", { className: "detail-title", children: orchestration?.displayName ?? node.label }), orchestration && (_jsx("span", { className: "detail-type-badge", children: STATUS_LABELS[orchestration.status] ?? orchestration.status })), _jsx("button", { className: "detail-close", type: "button", onClick: onClose, "aria-label": "Close panel", children: _jsx(X, { size: 14 }) })] }), _jsxs("div", { className: "detail-content", children: [_jsxs("div", { className: "detail-identity", children: [visuals && (_jsx("div", { className: "detail-glyph", children: _jsx(MascotGlyph, { color: visuals.color, animation: visuals.animation, expression: visuals.expression, accessory: visuals.accessory, ...(visuals.hairColor ? { hairColor: visuals.hairColor } : {}), scale: 6 }) })), _jsxs("div", { className: "detail-identity-info", children: [_jsx("div", { className: "detail-name", children: orchestration?.displayName ?? node.label }), _jsxs("div", { className: "detail-row", children: [_jsx("span", { className: "detail-label", children: "ID" }), _jsx("span", { className: "detail-value detail-value--mono", children: node.coordinationId })] }), orchestration?.description && (_jsxs("div", { className: "detail-row", children: [_jsx("span", { className: "detail-label", children: "Description" }), _jsx("span", { className: "detail-value", children: orchestration.description })] }))] })] }), _jsxs("div", { className: "detail-section", children: [_jsx("div", { className: "detail-section-title", children: "Actions" }), _jsxs("div", { className: "detail-actions", children: [_jsx("button", { type: "button", className: "detail-action-btn", onClick: () => onCreateAgent?.(node.coordinationId), children: ">_ Create Agent" }), _jsx("button", { type: "button", className: "detail-action-btn", disabled: spawningSwarmMode !== null, onClick: () => void handleSpawnSwarm("worktree"), children: spawningSwarmMode === "worktree" ? "Spawning..." : "\u2263 Spawn Swarm (Worktrees)" }), _jsx("button", { type: "button", className: "detail-action-btn", disabled: spawningSwarmMode !== null, onClick: () => void handleSpawnSwarm("shared"), children: spawningSwarmMode === "shared" ? "Spawning..." : "\u2263 Spawn Swarm (Normal)" })] }), spawnSwarmError ? _jsx("div", { className: "deck-add-form-error", children: spawnSwarmError }) : null] }), orchestration && (_jsxs("div", { className: "detail-section", children: [_jsx("div", { className: "detail-section-title", children: "Progress" }), orchestration.todoTotal > 0 && (_jsxs("div", { className: "detail-progress", children: [_jsx("div", { className: "detail-progress-bar", children: _jsx("div", { className: "detail-progress-fill", style: { width: `${progressPct}%`, backgroundColor: node.color } }) }), _jsxs("span", { className: "detail-progress-label", children: [orchestration.todoDone, "/", orchestration.todoTotal] })] })), orchestration.todoItems.length > 0 && (_jsx("ul", { className: "detail-todos", children: orchestration.todoItems.map((item, i) => (_jsxs("li", { className: `detail-todo${item.done ? " detail-todo--done" : ""}`, children: [_jsxs("div", { className: "detail-todo-controls", children: [_jsx("button", { type: "button", className: "detail-todo-delete", title: "Delete item", onClick: () => void handleTodoDelete(i), children: _jsx(X, { size: 12 }) }), _jsx("button", { type: "button", className: "detail-todo-solve", "aria-label": `Spawn agent for todo item: ${item.text}`, title: "Spawn agent for this item", disabled: item.done || solvingTodoIndex === i, onClick: () => void handleTodoSolve(i), children: solvingTodoIndex === i ? "…" : _jsx(Terminal, { size: 15, strokeWidth: 2.4 }) }), _jsx("input", { type: "checkbox", checked: item.done, onChange: () => handleTodoToggle(i, !item.done) })] }), editingIndex === i ? (_jsx("input", { className: "detail-todo-edit-input", type: "text", value: editText, onChange: (e) => setEditText(e.target.value), onKeyDown: (e) => {
                                                if (e.key === "Enter")
                                                    void handleTodoEdit(i, editText);
                                                if (e.key === "Escape")
                                                    setEditingIndex(null);
                                            }, onBlur: () => void handleTodoEdit(i, editText) })) : (_jsx("span", { className: "detail-todo-text", onDoubleClick: () => {
                                                setEditingIndex(i);
                                                setEditText(item.text);
                                            }, children: item.text }))] }, `${i}-${item.text}`))) })), addingTodo ? (_jsx("div", { className: "detail-todo-add-row", children: _jsx("input", { className: "detail-todo-edit-input", type: "text", placeholder: "New todo item\u2026", value: addText, onChange: (e) => setAddText(e.target.value), onKeyDown: (e) => {
                                        if (e.key === "Enter")
                                            void handleTodoAdd(addText);
                                        if (e.key === "Escape") {
                                            setAddingTodo(false);
                                            setAddText("");
                                        }
                                    }, onBlur: () => {
                                        if (addText.trim().length > 0) {
                                            void handleTodoAdd(addText);
                                        }
                                        else {
                                            setAddingTodo(false);
                                            setAddText("");
                                        }
                                    } }) })) : (_jsx("button", { type: "button", className: "detail-todo-add-btn", onClick: () => setAddingTodo(true), children: "+ Add item" }))] })), orchestration && orchestration.vaultFiles.length > 0 && (_jsxs("div", { className: "detail-section", children: [_jsx("div", { className: "detail-section-title", children: "Vault Files" }), _jsx("div", { className: "detail-labels-list", children: orchestration.vaultFiles.map((file) => (_jsx("span", { className: "detail-label-tag", children: file }, file))) })] })), orchestration && orchestration.suggestedSkills.length > 0 && (_jsxs("div", { className: "detail-section", children: [_jsx("div", { className: "detail-section-title", children: "Suggested Skills" }), _jsx("div", { className: "detail-labels-list", children: orchestration.suggestedSkills.map((skill) => (_jsx("span", { className: "detail-label-tag", children: skill }, skill))) })] })), _jsxs("div", { className: "detail-section", children: [_jsxs("div", { className: "detail-section-title", children: ["Sessions (", sessions.length, ")"] }), sessions.length === 0 ? (_jsx("div", { className: "detail-empty", children: "No sessions yet" })) : (_jsx("div", { className: "detail-sessions", children: sessions.map((s) => (_jsxs("button", { type: "button", className: "detail-session-item", onClick: () => onNavigateToConversation?.(s.sessionId), children: [_jsx("span", { className: "detail-session-preview", children: s.firstUserTurnPreview
                                                ? s.firstUserTurnPreview.slice(0, 60)
                                                : s.sessionId.slice(0, 16) }), _jsxs("span", { className: "detail-session-meta", children: [s.turnCount, " turns \u00B7 ", formatTime(s.lastEventAt)] })] }, s.sessionId))) }))] })] })] }));
};
