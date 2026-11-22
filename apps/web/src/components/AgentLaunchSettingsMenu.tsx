import type { TerminalAgentProvider } from "@adadex/core";

import { EFFORT_OPTIONS, type AgentLaunchSettings } from "../app/agentLaunchOptions";

type AgentLaunchSettingsMenuProps = {
  provider: TerminalAgentProvider;
  options: AgentLaunchSettings;
  isSaving: boolean;
  error: string | null;
  onChange: (patch: Partial<AgentLaunchSettings>) => void;
  onSave: () => void;
  onClose: () => void;
};

export const AgentLaunchSettingsMenu = ({
  provider,
  options,
  isSaving,
  error,
  onChange,
  onSave,
  onClose,
}: AgentLaunchSettingsMenuProps) => {
  const isClaude = provider === "claude";

  return (
    <dialog
      aria-label="Agent launch options"
      className="absolute bottom-full left-0 z-20 m-0 mb-2 w-72 rounded-lg border border-border bg-background p-3 shadow-lg"
      open
    >
      <div className="mb-2 flex items-center justify-between">
        <strong className="text-xs text-foreground">Model &amp; effort</strong>
        <button
          aria-label="Close launch options"
          className="rounded px-1 text-sm text-muted-foreground hover:text-foreground"
          onClick={onClose}
          type="button"
        >
          ×
        </button>
      </div>
      {isClaude ? (
        <>
          <label className="block text-[11px] text-muted-foreground">
            Model (optional)
            <input
              aria-label="Model (optional)"
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
              onChange={(event) => onChange({ model: event.target.value.trim() })}
              placeholder="default"
              type="text"
              value={options.model}
            />
          </label>
          <label className="mt-2 block text-[11px] text-muted-foreground">
            Effort
            <select
              aria-label="Effort"
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
              onChange={(event) => onChange({ effort: event.target.value })}
              value={options.effort}
            >
              {EFFORT_OPTIONS.map((level) => (
                <option key={level} value={level}>
                  {level === "" ? "default" : level}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Model and effort flags are only supported for Claude agents.
        </p>
      )}
      <p className="mt-2 text-[10px] text-muted-foreground">Applied when this agent next starts.</p>
      {error ? (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex justify-end gap-2">
        <button
          className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={onClose}
          type="button"
        >
          Cancel
        </button>
        <button
          className="rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background disabled:opacity-40"
          disabled={!isClaude || isSaving}
          onClick={onSave}
          type="button"
        >
          {isSaving ? "Saving…" : "Save"}
        </button>
      </div>
    </dialog>
  );
};
