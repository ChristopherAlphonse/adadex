import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { MascotSprite } from "../MascotSprite";
// ─── Status styling ──────────────────────────────────────────────────────────
export const STATUS_LABELS = {
    idle: "idle",
    active: "active",
    blocked: "blocked",
    "needs-review": "review",
};
// ─── TodoList ────────────────────────────────────────────────────────────────
export const TodoList = ({ items, coordinationId, onToggle, }) => {
    let lastDoneIndex = -1;
    for (let idx = items.length - 1; idx >= 0; idx--) {
        if (items[idx]?.done) {
            lastDoneIndex = idx;
            break;
        }
    }
    const scrollRef = useRef(null);
    useEffect(() => {
        scrollRef.current?.scrollIntoView({ block: "start" });
    }, []);
    return (_jsx("ul", { className: "deck-pod-todos", children: items.map((item, i) => (_jsxs("li", { ref: i === lastDoneIndex ? scrollRef : undefined, className: `deck-pod-todo-item${item.done ? " deck-pod-todo-item--done" : ""}`, children: [_jsx("input", { type: "checkbox", checked: item.done, className: "deck-pod-todo-checkbox", onChange: () => onToggle?.(coordinationId, i, !item.done) }), _jsx("span", { className: "deck-pod-todo-text", children: item.text })] }, item.text))) }));
};
export const OrchestrationPod = ({ orchestration, visuals, isFocused, activeFileName, onVaultFileClick, onVaultBrowse, onClose, onDelete, isDeleting, onTodoToggle, availableSkills, isSavingSkills, onSaveSuggestedSkills, }) => {
    const progressPct = orchestration.todoTotal > 0
        ? Math.round((orchestration.todoDone / orchestration.todoTotal) * 100)
        : 0;
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [isEditingSkills, setIsEditingSkills] = useState(false);
    const [draftSkills, setDraftSkills] = useState(orchestration.suggestedSkills);
    useEffect(() => {
        setDraftSkills(orchestration.suggestedSkills);
    }, [orchestration.suggestedSkills]);
    const availableSkillNames = availableSkills.map((skill) => skill.name);
    const skillNames = [...new Set([...availableSkillNames, ...draftSkills])].sort((a, b) => a.localeCompare(b));
    const toggleSkill = (skillName) => {
        setDraftSkills((current) => current.includes(skillName)
            ? current.filter((skill) => skill !== skillName)
            : [...current, skillName].sort((a, b) => a.localeCompare(b)));
    };
    const handleSaveSkills = async () => {
        const saved = await onSaveSuggestedSkills?.(orchestration.coordinationId, draftSkills);
        if (saved) {
            setIsEditingSkills(false);
        }
    };
    return (_jsxs("article", { className: `deck-pod${isFocused ? " deck-pod--focused" : ""}`, "data-status": orchestration.status, style: { borderColor: "var(--accent-primary)" }, children: [_jsxs("header", { className: "deck-pod-header", children: [isFocused && (_jsx("button", { type: "button", className: "deck-pod-btn deck-pod-btn--secondary", onClick: onClose, children: "\u2190 Back" })), _jsx("button", { type: "button", className: "deck-pod-btn", children: "Spawn" }), _jsx("button", { type: "button", className: "deck-pod-btn", onClick: () => {
                            setDraftSkills(orchestration.suggestedSkills);
                            setIsEditingSkills((current) => !current);
                        }, children: "Skills" }), _jsx("button", { type: "button", className: "deck-pod-btn", onClick: () => onVaultBrowse?.(), children: "Vault" }), confirmingDelete ? (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "deck-pod-btn deck-pod-btn--danger", disabled: isDeleting, onClick: () => onDelete?.(), children: isDeleting ? "..." : "Confirm Delete" }), _jsx("button", { type: "button", className: "deck-pod-btn deck-pod-btn--secondary", onClick: () => setConfirmingDelete(false), children: "Cancel" })] })) : (_jsx("button", { type: "button", className: "deck-pod-btn deck-pod-btn--delete", onClick: () => setConfirmingDelete(true), "aria-label": "Delete orchestration", children: _jsx("svg", { className: "deck-pod-btn-icon", viewBox: "0 0 16 16", "aria-hidden": "true", children: _jsx("path", { d: "M5.5 1.5h5M2 4h12M6 7v5M10 7v5M3.5 4l.75 9.5a1 1 0 001 .9h5.5a1 1 0 001-.9L12.5 4", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round" }) }) }))] }), _jsxs("div", { className: "deck-pod-body", children: [_jsx("span", { className: `deck-pod-status deck-pod-status--${orchestration.status}`, children: STATUS_LABELS[orchestration.status] }), _jsxs("div", { className: "deck-pod-identity", children: [_jsx("div", { className: "deck-pod-mascot-col", children: _jsx("div", { className: "deck-pod-mascot", children: _jsx(MascotSprite, { speedMs: 100, size: 100, color: visuals.color, animation: visuals.animation, expression: visuals.expression, accessory: visuals.accessory, ...(visuals.hairColor ? { hairColor: visuals.hairColor } : {}) }) }) }), _jsxs("div", { className: "deck-pod-identity-text", children: [_jsx("span", { className: "deck-pod-name", children: orchestration.displayName }), _jsx("span", { className: "deck-pod-description", children: orchestration.description })] })] }), _jsxs("div", { className: "deck-pod-details", children: [isEditingSkills && (_jsxs("div", { className: "deck-pod-skills-editor", children: [skillNames.length === 0 ? (_jsx("span", { className: "deck-pod-skills-empty", children: "No project skills found (.codex/skills)." })) : (_jsx("div", { className: "deck-pod-skills-options", children: skillNames.map((skillName) => {
                                            const skill = availableSkills.find((entry) => entry.name === skillName);
                                            return (_jsxs("label", { className: "deck-pod-skill-option", children: [_jsx("input", { type: "checkbox", checked: draftSkills.includes(skillName), onChange: () => toggleSkill(skillName) }), _jsxs("span", { className: "deck-pod-skill-copy", children: [_jsx("span", { className: "deck-pod-skill-name", children: skillName }), skill?.description && (_jsx("span", { className: "deck-pod-skill-desc", children: skill.description })), !skill && (_jsx("span", { className: "deck-pod-skill-desc", children: "Stored on this orchestration, but not available right now." }))] })] }, skillName));
                                        }) })), _jsxs("div", { className: "deck-pod-skills-actions", children: [_jsx("button", { type: "button", className: "deck-pod-btn deck-pod-btn--secondary", onClick: () => {
                                                    setDraftSkills(orchestration.suggestedSkills);
                                                    setIsEditingSkills(false);
                                                }, children: "Cancel" }), _jsx("button", { type: "button", className: "deck-pod-btn", disabled: Boolean(isSavingSkills), onClick: () => void handleSaveSkills(), children: isSavingSkills ? "Saving..." : "Save Skills" })] })] })), orchestration.todoTotal > 0 && (_jsxs("div", { className: "deck-pod-progress", children: [_jsx("div", { className: "deck-pod-progress-bar", children: _jsx("div", { className: "deck-pod-progress-fill", style: {
                                                width: `${progressPct}%`,
                                                backgroundColor: visuals.color,
                                            } }) }), _jsxs("span", { className: "deck-pod-progress-label", style: {
                                            backgroundColor: `${visuals.color}22`,
                                            color: visuals.color,
                                        }, children: [orchestration.todoDone, "/", orchestration.todoTotal, " done"] })] })), orchestration.todoItems.length > 0 && (_jsx(TodoList, { items: orchestration.todoItems, coordinationId: orchestration.coordinationId, onToggle: onTodoToggle })), orchestration.suggestedSkills.length > 0 && (_jsxs("div", { className: "deck-pod-vault", children: [_jsx("span", { className: "deck-pod-vault-label", children: "skills" }), _jsx("div", { className: "deck-pod-vault-files", children: orchestration.suggestedSkills.map((skill) => (_jsx("span", { className: "deck-pod-vault-file", children: skill }, skill))) })] })), orchestration.vaultFiles.length > 0 && (_jsxs("div", { className: "deck-pod-vault", children: [_jsx("span", { className: "deck-pod-vault-label", children: "vault" }), _jsx("div", { className: "deck-pod-vault-files", children: orchestration.vaultFiles.map((file) => (_jsx("button", { type: "button", className: "deck-pod-vault-file", "aria-current": activeFileName === file ? "true" : undefined, onClick: (e) => {
                                                e.stopPropagation();
                                                onVaultFileClick?.(file);
                                            }, children: file }, file))) })] }))] })] })] }));
};
