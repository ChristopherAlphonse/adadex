import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useClickOutside } from "../app/hooks/useClickOutside";
import { buildDeckOrchestrationSkillsUrl, buildDeckOrchestrationUrl, buildDeckOrchestrationsUrl, buildDeckSkillsUrl, buildDeckTodoToggleUrl, buildDeckVaultFileUrl, buildTerminalsUrl, } from "../runtime/runtimeEndpoints";
import { Terminal } from "./Terminal";
import { ActionCards } from "./deck/ActionCards";
import { AddOrchestrationForm } from "./deck/AddOrchestrationForm";
import { DeckBottomActions } from "./deck/DeckBottomActions";
import { OrchestrationPod } from "./deck/OrchestrationPod";
import { WorkspaceSetupCard } from "./deck/WorkspaceSetupCard";
import { deriveMascotVisuals } from "./deck/mascotVisuals";
import { MarkdownContent } from "./ui/MarkdownContent";
const normalizeDeckAvailableSkill = (value) => {
    if (value === null || typeof value !== "object")
        return null;
    const record = value;
    if (typeof record.name !== "string")
        return null;
    return {
        name: record.name,
        description: typeof record.description === "string" ? record.description : "",
        source: record.source === "project" ? "project" : "user",
    };
};
export const DeckPrimaryView = ({ onSidebarContent, workspaceSetup, isWorkspaceSetupLoading, workspaceSetupError, onRefreshWorkspaceSetup, onRunWorkspaceSetupStep, suppressWorkspaceSetupCard = false, }) => {
    const [orchestrations, setOrchestrations] = useState([]);
    const [focus, setFocus] = useState(null);
    const [vaultContent, setVaultContent] = useState(null);
    const [loadingVault, setLoadingVault] = useState(false);
    const [emptyViewMode, setEmptyViewMode] = useState("idle");
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState(null);
    const [availableSkills, setAvailableSkills] = useState([]);
    const [savingOrchestrationSkillsId, setSavingOrchestrationSkillsId] = useState(null);
    const [selectedAgent, setSelectedAgent] = useState("codex");
    const [agentMenuOpen, setAgentMenuOpen] = useState(false);
    const agentMenuRef = useRef(null);
    const [isLaunchingAgent, setIsLaunchingAgent] = useState(false);
    const [runningSetupStepId, setRunningSetupStepId] = useState(null);
    // Fetch orchestration list
    const fetchOrchestrations = useCallback(async () => {
        try {
            const response = await fetch(buildDeckOrchestrationsUrl(), {
                headers: { Accept: "application/json" },
            });
            if (!response.ok)
                return;
            const data = await response.json();
            setOrchestrations(data);
            await onRefreshWorkspaceSetup();
        }
        catch {
            // silently ignore
        }
    }, [onRefreshWorkspaceSetup]);
    useEffect(() => {
        void fetchOrchestrations();
    }, [fetchOrchestrations]);
    useEffect(() => {
        let cancelled = false;
        const fetchSkills = async () => {
            try {
                const response = await fetch(buildDeckSkillsUrl(), {
                    headers: { Accept: "application/json" },
                });
                if (!response.ok)
                    return;
                const payload = (await response.json());
                if (!Array.isArray(payload) || cancelled)
                    return;
                const skills = payload
                    .map((entry) => normalizeDeckAvailableSkill(entry))
                    .filter((entry) => entry !== null);
                if (!cancelled) {
                    setAvailableSkills(skills);
                }
            }
            catch {
                // silently ignore
            }
        };
        void fetchSkills();
        return () => {
            cancelled = true;
        };
    }, []);
    // Precompute visuals for all orchestrations
    const visualsMap = useMemo(() => {
        const map = new Map();
        for (const t of orchestrations) {
            map.set(t.coordinationId, deriveMascotVisuals(t));
        }
        return map;
    }, [orchestrations]);
    // Fetch vault file content when focus changes
    useEffect(() => {
        if (!focus || focus.type !== "vault") {
            setVaultContent(null);
            return;
        }
        let cancelled = false;
        setLoadingVault(true);
        const fetchVault = async () => {
            try {
                const response = await fetch(buildDeckVaultFileUrl(focus.coordinationId, focus.fileName), {
                    headers: { Accept: "text/markdown" },
                });
                if (cancelled)
                    return;
                if (!response.ok) {
                    setVaultContent(null);
                    setLoadingVault(false);
                    return;
                }
                const text = await response.text();
                if (!cancelled) {
                    setVaultContent(text);
                    setLoadingVault(false);
                }
            }
            catch {
                if (!cancelled) {
                    setVaultContent(null);
                    setLoadingVault(false);
                }
            }
        };
        void fetchVault();
        return () => {
            cancelled = true;
        };
    }, [focus]);
    // Agent menu click-outside/escape
    const handleDismissAgentMenu = useCallback(() => setAgentMenuOpen(false), []);
    useClickOutside(agentMenuRef, agentMenuOpen, handleDismissAgentMenu);
    const handleVaultFileClick = useCallback((coordinationId, fileName) => {
        setFocus({ type: "vault", coordinationId, fileName });
    }, []);
    const handleClose = useCallback(() => {
        setFocus(null);
    }, []);
    const handleLaunchAgent = useCallback(async () => {
        setIsLaunchingAgent(true);
        try {
            const response = await fetch(buildTerminalsUrl(), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify({
                    name: "coordination-planner",
                    workspaceMode: "shared",
                    agentProvider: selectedAgent,
                    promptTemplate: "coordination-planner",
                }),
            });
            if (!response.ok)
                return;
            const data = await response.json();
            const agentId = (data.terminalId ?? data.coordinationId);
            setFocus({
                type: "terminal",
                agentId,
                terminalLabel: "Orchestration Planner",
            });
            await fetchOrchestrations();
        }
        catch {
            // silently ignore
        }
        finally {
            setIsLaunchingAgent(false);
        }
    }, [selectedAgent, fetchOrchestrations]);
    const handleRunSetupStep = useCallback(async (stepId) => {
        setRunningSetupStepId(stepId);
        try {
            await onRunWorkspaceSetupStep(stepId);
            if (stepId === "initialize-workspace" || stepId === "ensure-gitignore") {
                await fetchOrchestrations();
            }
        }
        finally {
            setRunningSetupStepId(null);
        }
    }, [fetchOrchestrations, onRunWorkspaceSetupStep]);
    const handleCreateCoordination = useCallback(async (name, description, color, mascot, suggestedSkills) => {
        setIsCreating(true);
        setCreateError(null);
        try {
            const response = await fetch(buildDeckOrchestrationsUrl(), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify({
                    name,
                    description,
                    color,
                    mascot,
                    suggestedSkills,
                }),
            });
            if (!response.ok) {
                const body = await response.json().catch(() => null);
                const msg = body && typeof body === "object" && "error" in body && typeof body.error === "string"
                    ? body.error
                    : "Failed to create orchestration";
                setCreateError(msg);
                return;
            }
            setEmptyViewMode("idle");
            await fetchOrchestrations();
            await onRefreshWorkspaceSetup();
        }
        catch {
            setCreateError("Network error");
        }
        finally {
            setIsCreating(false);
        }
    }, [fetchOrchestrations, onRefreshWorkspaceSetup]);
    const handleOrchestrationSkillsSave = useCallback(async (coordinationId, suggestedSkills) => {
        setSavingOrchestrationSkillsId(coordinationId);
        try {
            const response = await fetch(buildDeckOrchestrationSkillsUrl(coordinationId), {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify({ suggestedSkills }),
            });
            if (!response.ok)
                return false;
            await fetchOrchestrations();
            return true;
        }
        catch {
            return false;
        }
        finally {
            setSavingOrchestrationSkillsId((current) => (current === coordinationId ? null : current));
        }
    }, [fetchOrchestrations]);
    const [deletingOrchestrationId, setDeletingOrchestrationId] = useState(null);
    const handleDeleteOrchestration = useCallback(async (coordinationId) => {
        setDeletingOrchestrationId(coordinationId);
        try {
            const response = await fetch(buildDeckOrchestrationUrl(coordinationId), {
                method: "DELETE",
            });
            if (!response.ok)
                return;
            await fetchOrchestrations();
        }
        catch {
            // silently ignore
        }
        finally {
            setDeletingOrchestrationId(null);
        }
    }, [fetchOrchestrations]);
    const handleTodoToggle = useCallback(async (coordinationId, itemIndex, done) => {
        try {
            const response = await fetch(buildDeckTodoToggleUrl(coordinationId), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ itemIndex, done }),
            });
            if (!response.ok)
                return;
            await fetchOrchestrations();
        }
        catch {
            // silently ignore
        }
    }, [fetchOrchestrations]);
    const focusedOrchestration = focus?.type === "vault" || focus?.type === "vault-browser"
        ? orchestrations.find((t) => t.coordinationId === focus.coordinationId)
        : null;
    const mode = focus ? "detail" : "grid";
    const shouldShowWorkspaceSetup = !suppressWorkspaceSetupCard &&
        orchestrations.length === 0 &&
        workspaceSetup?.shouldShowSetupCard;
    // Push sidebar content to the shared sidebar
    const sidebarContent = useMemo(() => orchestrations.length > 0 || focus?.type === "terminal" || shouldShowWorkspaceSetup ? (_jsxs("div", { className: "deck-sidebar-content", children: [_jsx("div", { className: "deck-sidebar-content-top", children: shouldShowWorkspaceSetup ? (_jsx(WorkspaceSetupCard, { compact: true, workspaceSetup: workspaceSetup, isLoading: isWorkspaceSetupLoading, error: workspaceSetupError, onRunStep: handleRunSetupStep, onLaunchAgent: handleLaunchAgent, isLaunchingAgent: isLaunchingAgent, isRunningStepId: runningSetupStepId })) : (_jsx(ActionCards, { compact: true, selectedAgent: selectedAgent, setSelectedAgent: setSelectedAgent, agentMenuOpen: agentMenuOpen, setAgentMenuOpen: setAgentMenuOpen, agentMenuRef: agentMenuRef, onAdd: () => {
                        setEmptyViewMode("adding");
                        setCreateError(null);
                    }, onLaunchAgent: handleLaunchAgent, isLaunchingAgent: isLaunchingAgent })) }), orchestrations.length > 0 && (_jsx("div", { className: "deck-sidebar-content-bottom", children: _jsx(DeckBottomActions, { onClearAll: async () => {
                        for (const t of orchestrations) {
                            await fetch(buildDeckOrchestrationUrl(t.coordinationId), {
                                method: "DELETE",
                            });
                        }
                        await fetchOrchestrations();
                    } }) }))] })) : null, [
        agentMenuOpen,
        fetchOrchestrations,
        focus?.type,
        handleLaunchAgent,
        handleRunSetupStep,
        isLaunchingAgent,
        isWorkspaceSetupLoading,
        runningSetupStepId,
        selectedAgent,
        shouldShowWorkspaceSetup,
        orchestrations,
        workspaceSetup,
        workspaceSetupError,
    ]);
    useEffect(() => {
        onSidebarContent?.(sidebarContent);
        return () => onSidebarContent?.(null);
    }, [onSidebarContent, sidebarContent]);
    // ─── Empty state (no orchestrations) ─────────────────────────────────────────────
    if (orchestrations.length === 0 && focus?.type !== "terminal") {
        return (_jsx("section", { className: "deck-view", "data-mode": "grid", "data-empty-mode": emptyViewMode, "aria-label": "Deck", children: _jsxs("div", { className: "deck-empty-state", children: [_jsx("div", { className: "deck-empty-left", children: shouldShowWorkspaceSetup ? (_jsx(WorkspaceSetupCard, { workspaceSetup: workspaceSetup, isLoading: isWorkspaceSetupLoading, error: workspaceSetupError, onRunStep: handleRunSetupStep, onLaunchAgent: handleLaunchAgent, isLaunchingAgent: isLaunchingAgent, isRunningStepId: runningSetupStepId })) : (_jsx(ActionCards, { selectedAgent: selectedAgent, setSelectedAgent: setSelectedAgent, agentMenuOpen: agentMenuOpen, setAgentMenuOpen: setAgentMenuOpen, agentMenuRef: agentMenuRef, onAdd: () => {
                                setEmptyViewMode("adding");
                                setCreateError(null);
                            }, onLaunchAgent: handleLaunchAgent, isLaunchingAgent: isLaunchingAgent })) }), emptyViewMode === "adding" && (_jsx("div", { className: "deck-empty-right", children: _jsx(AddOrchestrationForm, { onSubmit: handleCreateCoordination, onCancel: () => setEmptyViewMode("idle"), isSubmitting: isCreating, error: createError, availableSkills: availableSkills }) }))] }) }));
    }
    // ─── Populated state ────────────────────────────────────────────────────────
    return (_jsxs("section", { className: "deck-view", "data-mode": mode, "data-has-pods": orchestrations.length > 0, "aria-label": "Deck", children: [_jsxs("div", { className: "deck-pods-container", children: [orchestrations.map((t) => {
                        const isThis = (focus?.type === "vault" || focus?.type === "vault-browser") &&
                            focus.coordinationId === t.coordinationId;
                        return (_jsx("div", { className: "deck-pod-slot", "data-pod-role": isThis ? "focused" : focus ? "other" : "idle", children: _jsx(OrchestrationPod, { orchestration: t, visuals: visualsMap.get(t.coordinationId), isFocused: isThis, activeFileName: focus?.type === "vault" && isThis ? focus.fileName : undefined, onVaultFileClick: (fileName) => setFocus({
                                    type: "vault",
                                    coordinationId: t.coordinationId,
                                    fileName,
                                }), onVaultBrowse: () => setFocus({
                                    type: "vault-browser",
                                    coordinationId: t.coordinationId,
                                }), onClose: handleClose, onDelete: () => handleDeleteOrchestration(t.coordinationId), isDeleting: deletingOrchestrationId === t.coordinationId, onTodoToggle: handleTodoToggle, availableSkills: availableSkills, isSavingSkills: savingOrchestrationSkillsId === t.coordinationId, onSaveSuggestedSkills: handleOrchestrationSkillsSave }) }, t.coordinationId));
                    }), emptyViewMode === "adding" && (_jsx("div", { className: "deck-pod-slot", children: _jsx(AddOrchestrationForm, { onSubmit: handleCreateCoordination, onCancel: () => setEmptyViewMode("idle"), isSubmitting: isCreating, error: createError, availableSkills: availableSkills }) }))] }), _jsxs("div", { className: "deck-detail-main", children: [focus?.type === "vault-browser" && focusedOrchestration && (_jsxs(_Fragment, { children: [_jsxs("header", { className: "deck-detail-main-header", children: [_jsx("button", { type: "button", className: "deck-add-form-back", onClick: handleClose, children: "\u2190 Back" }), _jsxs("span", { className: "deck-detail-main-path", children: [_jsx("strong", { children: focusedOrchestration.displayName }), " / vault"] })] }), _jsx("div", { className: "deck-detail-main-content deck-vault-browser", children: _jsxs("pre", { className: "deck-vault-tree", children: [_jsxs("span", { className: "deck-vault-tree-dir", children: [".adadex/coordinations/", focusedOrchestration.coordinationId, "/"] }), (() => {
                                            const files = [...focusedOrchestration.vaultFiles, "CONTEXT.md"];
                                            return files.map((file, i) => {
                                                const isLast = i === files.length - 1;
                                                const prefix = isLast ? "└── " : "├── ";
                                                return (_jsxs("span", { className: "deck-vault-tree-row", children: [_jsx("span", { className: "deck-vault-tree-branch", children: prefix }), _jsx("button", { type: "button", className: "deck-vault-tree-file", onClick: () => setFocus({
                                                                type: "vault",
                                                                coordinationId: focus.coordinationId,
                                                                fileName: file,
                                                            }), children: file })] }, file));
                                            });
                                        })()] }) })] })), focus?.type === "vault" && focusedOrchestration && (_jsxs(_Fragment, { children: [_jsxs("header", { className: "deck-detail-main-header", children: [_jsx("button", { type: "button", className: "deck-add-form-back", onClick: () => setFocus({
                                            type: "vault-browser",
                                            coordinationId: focus.coordinationId,
                                        }), children: "\u2190 Back" }), _jsxs("span", { className: "deck-detail-main-path", children: [focusedOrchestration.displayName, " / ", _jsx("strong", { children: focus.fileName })] })] }), _jsx("div", { className: "deck-detail-main-content", children: loadingVault ? (_jsx("span", { className: "deck-detail-loading", children: "Loading\u2026" })) : vaultContent !== null ? (_jsx(MarkdownContent, { content: vaultContent, className: "deck-detail-markdown" })) : (_jsx("span", { className: "deck-detail-loading", children: "File not found." })) }, `${focus.coordinationId}/${focus.fileName}`)] })), focus?.type === "terminal" && (_jsxs("div", { className: "deck-detail-terminal", children: [_jsxs("header", { className: "deck-detail-main-header", children: [_jsx("button", { type: "button", className: "deck-add-form-back", onClick: handleClose, children: "\u2190 Back" }), _jsx("span", { className: "deck-detail-main-path", children: _jsx("strong", { children: focus.terminalLabel }) })] }), _jsx(Terminal, { terminalId: focus.agentId, terminalLabel: focus.terminalLabel })] }, focus.agentId))] })] }));
};
