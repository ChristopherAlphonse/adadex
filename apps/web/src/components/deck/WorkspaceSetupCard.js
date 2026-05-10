import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Minimize2, X } from "lucide-react";
import { MascotSprite } from "../MascotSprite";
const buildStepSummary = (stepId, description) => {
    if (stepId === "create-coordinations") {
        return "Launch Codex so it can plan and create your first coordinations.";
    }
    return description;
};
export const WorkspaceSetupCard = ({ compact, workspaceSetup, isLoading, error, onRunStep, onLaunchAgent, isLaunchingAgent, isRunningStepId, onMinimize, onDismiss, }) => (_jsxs("section", { className: `workspace-setup-card${compact ? " workspace-setup-card--compact" : ""}`, "aria-label": "Workspace setup", children: [onMinimize || onDismiss ? (_jsxs("div", { className: "workspace-setup-card-overlay-actions", role: "toolbar", "aria-label": "Workspace setup panel", children: [onMinimize ? (_jsx("button", { type: "button", className: "workspace-setup-card-overlay-btn", "aria-label": "Minimize workspace setup", onClick: onMinimize, children: _jsx(Minimize2, { size: 16, strokeWidth: 2, "aria-hidden": true }) })) : null, onDismiss ? (_jsx("button", { type: "button", className: "workspace-setup-card-overlay-btn", "aria-label": "Hide workspace setup", onClick: onDismiss, children: _jsx(X, { size: 16, strokeWidth: 2, "aria-hidden": true }) })) : null] })) : null, _jsxs("header", { className: "workspace-setup-card-header", children: [_jsx("div", { className: "workspace-setup-card-glyph", children: _jsx(MascotSprite, { color: "#a3e635", speedMs: 16, size: compact ? 112 : 128 }) }), _jsxs("div", { className: "workspace-setup-card-copy", children: [_jsx("h2", { className: "workspace-setup-card-title", children: "Workspace Setup" }), _jsx("p", { className: "workspace-setup-card-desc", children: "Run each step explicitly. Adadex only marks it done after the workspace is checked again." })] })] }), error ? _jsx("p", { className: "workspace-setup-card-error", children: error }) : null, _jsxs("div", { className: "workspace-setup-step-list", children: [(workspaceSetup?.steps ?? []).map((step) => {
                    const isCreateCoordinationsStep = step.id === "create-coordinations";
                    const buttonLabel = isCreateCoordinationsStep ? "Launch Codex" : step.actionLabel;
                    const isButtonDisabled = isCreateCoordinationsStep ? isLaunchingAgent : isLoading;
                    const isButtonRunning = isCreateCoordinationsStep
                        ? isLaunchingAgent
                        : isRunningStepId === step.id;
                    return (_jsxs("article", { className: "workspace-setup-step", "data-complete": step.complete, children: [_jsxs("div", { className: "workspace-setup-step-main", children: [_jsxs("div", { className: "workspace-setup-step-title-row", children: [_jsx("span", { className: "workspace-setup-step-title", children: step.title }), _jsx("span", { className: "workspace-setup-step-state", children: step.complete ? "Done" : step.required ? "Required" : "Optional" })] }), _jsx("p", { className: "workspace-setup-step-desc", children: buildStepSummary(step.id, step.description) })] }), buttonLabel ? (_jsx("button", { type: "button", className: "workspace-setup-step-action", disabled: Boolean(isButtonDisabled), onClick: () => {
                                    if (isCreateCoordinationsStep) {
                                        onLaunchAgent();
                                        return;
                                    }
                                    onRunStep(step.id);
                                }, children: isButtonRunning ? "..." : buttonLabel })) : null] }, step.id));
                }), isLoading && workspaceSetup === null ? (_jsx("p", { className: "workspace-setup-card-loading", children: "Loading workspace setup\u2026" })) : null] })] }));
