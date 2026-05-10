import type { WorkspaceSetupSnapshot, WorkspaceSetupStepId } from "@adadex/core";
import { Minimize2, X } from "lucide-react";

import { MascotSprite } from "../MascotSprite";

type WorkspaceSetupCardProps = {
  compact?: boolean;
  workspaceSetup: WorkspaceSetupSnapshot | null;
  isLoading: boolean;
  error: string | null;
  onRunStep: (stepId: WorkspaceSetupStepId) => void;
  onLaunchAgent: () => void;
  isLaunchingAgent?: boolean;
  isRunningStepId?: WorkspaceSetupStepId | null;
  /** Canvas overlay: collapse to a slim bar (same session). */
  onMinimize?: () => void;
  /** Canvas overlay: hide until reopened from the canvas toolbar. */
  onDismiss?: () => void;
};

const buildStepSummary = (stepId: WorkspaceSetupStepId, description: string) => {
  if (stepId === "create-coordinations") {
    return "Launch Codex so it can plan and create your first coordinations.";
  }

  return description;
};

export const WorkspaceSetupCard = ({
  compact,
  workspaceSetup,
  isLoading,
  error,
  onRunStep,
  onLaunchAgent,
  isLaunchingAgent,
  isRunningStepId,
  onMinimize,
  onDismiss,
}: WorkspaceSetupCardProps) => (
  <section
    className={`workspace-setup-card${compact ? " workspace-setup-card--compact" : ""}`}
    aria-label="Workspace setup"
  >
    {onMinimize || onDismiss ? (
      <div
        className="workspace-setup-card-overlay-actions"
        role="toolbar"
        aria-label="Workspace setup panel"
      >
        {onMinimize ? (
          <button
            type="button"
            className="workspace-setup-card-overlay-btn"
            aria-label="Minimize workspace setup"
            onClick={onMinimize}
          >
            <Minimize2 size={16} strokeWidth={2} aria-hidden />
          </button>
        ) : null}
        {onDismiss ? (
          <button
            type="button"
            className="workspace-setup-card-overlay-btn"
            aria-label="Hide workspace setup"
            onClick={onDismiss}
          >
            <X size={16} strokeWidth={2} aria-hidden />
          </button>
        ) : null}
      </div>
    ) : null}
    <header className="workspace-setup-card-header">
      <div className="workspace-setup-card-glyph">
        <MascotSprite color="#a3e635" speedMs={16} size={compact ? 112 : 128} />
      </div>
      <div className="workspace-setup-card-copy">
        <h2 className="workspace-setup-card-title">Workspace Setup</h2>
        <p className="workspace-setup-card-desc">
          Run each step explicitly. Adadex only marks it done after the workspace is checked again.
        </p>
      </div>
    </header>

    {error ? <p className="workspace-setup-card-error">{error}</p> : null}

    <div className="workspace-setup-step-list">
      {(workspaceSetup?.steps ?? []).map((step) => {
        const isCreateCoordinationsStep = step.id === "create-coordinations";
        const buttonLabel = isCreateCoordinationsStep ? "Launch Codex" : step.actionLabel;
        const isButtonDisabled = isCreateCoordinationsStep ? isLaunchingAgent : isLoading;
        const isButtonRunning = isCreateCoordinationsStep
          ? isLaunchingAgent
          : isRunningStepId === step.id;

        return (
          <article key={step.id} className="workspace-setup-step" data-complete={step.complete}>
            <div className="workspace-setup-step-main">
              <div className="workspace-setup-step-title-row">
                <span className="workspace-setup-step-title">{step.title}</span>
                <span className="workspace-setup-step-state">
                  {step.complete ? "Done" : step.required ? "Required" : "Optional"}
                </span>
              </div>
              <p className="workspace-setup-step-desc">
                {buildStepSummary(step.id, step.description)}
              </p>
            </div>
            {buttonLabel ? (
              <button
                type="button"
                className="workspace-setup-step-action"
                disabled={Boolean(isButtonDisabled)}
                onClick={() => {
                  if (isCreateCoordinationsStep) {
                    onLaunchAgent();
                    return;
                  }

                  onRunStep(step.id);
                }}
              >
                {isButtonRunning ? "..." : buttonLabel}
              </button>
            ) : null}
          </article>
        );
      })}
      {isLoading && workspaceSetup === null ? (
        <p className="workspace-setup-card-loading">Loading workspace setup…</p>
      ) : null}
    </div>
  </section>
);
