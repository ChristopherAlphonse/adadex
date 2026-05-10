import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { usePromptLibrary } from "../app/hooks/usePromptLibrary";
import { SidebarPromptsList } from "./SidebarPromptsList";
import { Terminal } from "./Terminal";
import { ActionButton } from "./ui/ActionButton";
import { MarkdownContent } from "./ui/MarkdownContent";
export const PromptsPrimaryView = ({ enabled, onSidebarContent }) => {
    const { prompts, selectedPromptName, selectedPromptDetail: selectedPrompt, isLoadingPrompts, isLoadingDetail, isEditing, editDraft, errorMessage, refreshPrompts, selectPrompt: selectPromptLibraryItem, deletePrompt: deletePromptLibraryItem, startEditing: onStartEditing, cancelEditing: onCancelEditing, setEditDraft: onSetEditDraft, submitEdit: onSubmitEdit, } = usePromptLibrary({ enabled });
    const [promptEngineerTerminalId, setPromptEngineerTerminalId] = useState(null);
    const [newPromptRequestCount, setNewPromptRequestCount] = useState(0);
    const [restoreTerminalCount, setRestoreTerminalCount] = useState(0);
    const [closeTerminalCount, setCloseTerminalCount] = useState(0);
    const onDelete = useCallback(() => {
        if (selectedPromptName) {
            return deletePromptLibraryItem(selectedPromptName);
        }
        return Promise.resolve(false);
    }, [selectedPromptName, deletePromptLibraryItem]);
    const onRefresh = refreshPrompts;
    const onTerminalIdChange = setPromptEngineerTerminalId;
    // Push sidebar content
    const sidebarContent = (_jsx(SidebarPromptsList, { prompts: prompts, selectedPromptName: selectedPromptName, isLoadingPrompts: isLoadingPrompts, onSelectPrompt: selectPromptLibraryItem, onRefresh: () => {
            void refreshPrompts();
        }, onNewPrompt: () => {
            setNewPromptRequestCount((c) => c + 1);
        }, activeTerminalId: promptEngineerTerminalId, onRestoreTerminal: () => {
            setRestoreTerminalCount((c) => c + 1);
        }, onCloseTerminal: () => {
            setCloseTerminalCount((c) => c + 1);
        } }));
    useEffect(() => {
        onSidebarContent?.(sidebarContent);
        return () => onSidebarContent?.(null);
    });
    const [newPromptMode, setNewPromptMode] = useState(null);
    const [, setIsCreatingTerminal] = useState(false);
    const [showTerminal, setShowTerminal] = useState(false);
    const handleNewPrompt = useCallback(async () => {
        setIsCreatingTerminal(true);
        try {
            const res = await fetch("/api/terminals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workspaceMode: "shared",
                    agentProvider: "codex",
                    promptTemplate: "meta-prompt-generator",
                }),
            });
            if (!res.ok)
                throw new Error("Failed to create terminal");
            const data = (await res.json());
            const agentId = (data.terminalId ?? data.coordinationId);
            setNewPromptMode({ terminalId: agentId });
            setShowTerminal(true);
            onTerminalIdChange(agentId);
        }
        catch {
            // Silently fail — the user can retry
        }
        finally {
            setIsCreatingTerminal(false);
        }
    }, [onTerminalIdChange]);
    useEffect(() => {
        if (newPromptRequestCount > 0) {
            void handleNewPrompt();
        }
    }, [newPromptRequestCount, handleNewPrompt]);
    // When a prompt is selected from the sidebar, switch away from terminal view
    useEffect(() => {
        if (selectedPrompt) {
            setShowTerminal(false);
        }
    }, [selectedPrompt]);
    // When the sidebar's minimized bar is clicked, restore terminal view
    useEffect(() => {
        if (restoreTerminalCount > 0) {
            setShowTerminal(true);
        }
    }, [restoreTerminalCount]);
    // When the sidebar's close button is clicked, destroy the terminal
    useEffect(() => {
        if (closeTerminalCount > 0) {
            setNewPromptMode(null);
            setShowTerminal(false);
            onTerminalIdChange(null);
            void onRefresh();
        }
    }, [closeTerminalCount, onRefresh, onTerminalIdChange]);
    const handleBackToLibrary = useCallback(() => {
        setNewPromptMode(null);
        setShowTerminal(false);
        onTerminalIdChange(null);
        void onRefresh();
    }, [onRefresh, onTerminalIdChange]);
    const showPromptDetail = !showTerminal || !newPromptMode;
    return (_jsxs("section", { className: "prompts-view", "aria-label": "Prompts primary view", children: [newPromptMode && (_jsxs("div", { className: "prompts-terminal", style: showTerminal ? undefined : { display: "none" }, children: [_jsxs("header", { className: "prompts-terminal-header", children: [_jsx("button", { type: "button", className: "prompts-terminal-back", onClick: handleBackToLibrary, children: "\u2190 Back" }), _jsx("span", { className: "prompts-terminal-label", children: _jsx("strong", { children: "Prompt Engineer" }) })] }), _jsx(Terminal, { terminalId: newPromptMode.terminalId, terminalLabel: "Prompt Engineer", hidePromptPicker: true })] }, newPromptMode.terminalId)), showPromptDetail && (_jsxs(_Fragment, { children: [errorMessage ? _jsx("p", { className: "prompts-error", children: errorMessage }) : null, isLoadingDetail ? (_jsx("p", { className: "prompts-empty", children: "Loading prompt..." })) : selectedPrompt ? (_jsxs("div", { className: "prompts-detail", children: [_jsxs("header", { className: "prompts-detail-header", children: [_jsxs("div", { className: "prompts-detail-header-left", children: [_jsx("h3", { className: "prompts-detail-name", children: selectedPrompt.name }), _jsx("span", { className: "prompts-detail-source-badge", "data-source": selectedPrompt.source, children: selectedPrompt.source === "user" ? "User" : "Built-in" })] }), selectedPrompt.source === "user" && (_jsx("div", { className: "prompts-detail-header-actions", children: isEditing ? (_jsxs(_Fragment, { children: [_jsx(ActionButton, { onClick: () => {
                                                        void onSubmitEdit();
                                                    }, children: "Save" }), _jsx(ActionButton, { onClick: onCancelEditing, children: "Cancel" })] })) : (_jsxs(_Fragment, { children: [_jsx(ActionButton, { onClick: onStartEditing, children: "Edit" }), _jsx(ActionButton, { onClick: () => {
                                                        void onDelete();
                                                    }, children: "Delete" })] })) }))] }), isEditing ? (_jsx("textarea", { className: "prompts-edit-area", value: editDraft, onChange: (e) => {
                                    onSetEditDraft(e.target.value);
                                }, spellCheck: false })) : (_jsx("div", { className: "prompts-content", children: _jsx(MarkdownContent, { content: selectedPrompt.content }) }))] })) : (_jsx("div", { className: "prompts-empty-state", children: _jsx("p", { className: "prompts-empty", children: "Select a prompt from the sidebar, or create a new one." }) }))] }))] }));
};
