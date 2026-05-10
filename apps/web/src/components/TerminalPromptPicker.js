import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from "react";
import { buildPromptItemUrl, buildPromptsUrl } from "../runtime/runtimeEndpoints";
export const TerminalPromptPicker = ({ isOpen, anchorRef, onClose, onSelectPrompt, }) => {
    const [prompts, setPrompts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const popoverRef = useRef(null);
    const [style, setStyle] = useState({});
    useEffect(() => {
        if (!isOpen || !anchorRef.current)
            return;
        const rect = anchorRef.current.getBoundingClientRect();
        setStyle({
            position: "fixed",
            top: rect.bottom + 2,
            right: window.innerWidth - rect.right,
        });
    }, [isOpen, anchorRef]);
    useEffect(() => {
        if (!isOpen)
            return;
        setIsLoading(true);
        fetch(buildPromptsUrl())
            .then(async (res) => {
            if (!res.ok)
                return;
            const data = (await res.json());
            setPrompts(data.prompts);
        })
            .catch(() => {
            // Silently fail
        })
            .finally(() => {
            setIsLoading(false);
        });
    }, [isOpen]);
    useEffect(() => {
        if (!isOpen)
            return;
        const handleClickOutside = (e) => {
            if (popoverRef.current &&
                !popoverRef.current.contains(e.target) &&
                anchorRef.current &&
                !anchorRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen, onClose, anchorRef]);
    const handleSelectPrompt = useCallback(async (name) => {
        try {
            const res = await fetch(buildPromptItemUrl(name));
            if (!res.ok)
                return;
            const data = (await res.json());
            onSelectPrompt(data.content);
            onClose();
        }
        catch {
            // Silently fail
        }
    }, [onSelectPrompt, onClose]);
    if (!isOpen)
        return null;
    const userPrompts = prompts.filter((p) => p.source === "user");
    const builtinPrompts = prompts.filter((p) => p.source === "builtin");
    return (_jsxs("div", { className: "prompt-picker-popover", ref: popoverRef, style: style, children: [_jsx("div", { className: "prompt-picker-header", children: "Insert Prompt" }), isLoading ? (_jsx("div", { className: "prompt-picker-loading", children: "Loading..." })) : prompts.length === 0 ? (_jsx("div", { className: "prompt-picker-empty", children: "No prompts available" })) : (_jsxs("div", { className: "prompt-picker-list", children: [userPrompts.length > 0 && (_jsxs("div", { className: "prompt-picker-group", children: [_jsx("div", { className: "prompt-picker-group-label", children: "My Prompts" }), userPrompts.map((p) => (_jsxs("button", { type: "button", className: "prompt-picker-item", onClick: () => {
                                    void handleSelectPrompt(p.name);
                                }, children: [p.name, ".md"] }, p.name)))] })), builtinPrompts.length > 0 && (_jsxs("div", { className: "prompt-picker-group", children: [_jsx("div", { className: "prompt-picker-group-label", children: "Built-in" }), builtinPrompts.map((p) => (_jsxs("button", { type: "button", className: "prompt-picker-item", onClick: () => {
                                    void handleSelectPrompt(p.name);
                                }, children: [p.name, ".md"] }, p.name)))] }))] }))] }));
};
