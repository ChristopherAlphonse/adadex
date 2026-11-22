import { Network } from "lucide-react";
import type { ComponentType } from "react";

export type AgentsViewId = "graph";

type ViewOption = {
  id: AgentsViewId;
  label: string;
  description: string;
  hotkey: string;
  icon: ComponentType<{ size?: number }>;
};

const VIEW_OPTIONS: readonly ViewOption[] = [
  {
    id: "graph",
    label: "Graph",
    description: "See every agent and how they connect.",
    hotkey: "G",
    icon: Network,
  },
];

type AgentsViewPickerProps = {
  onOpen: (view: AgentsViewId) => void;
};

export const AgentsViewPicker = ({ onOpen }: AgentsViewPickerProps) => (
  <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
    <div className="text-center">
      <h2 className="m-0 text-base font-semibold text-foreground">Open a view</h2>
      <p className="m-0 mt-1 text-sm text-muted-foreground">
        Views belong to this workspace, so they stay put when you switch sessions.
      </p>
    </div>
    <div className="grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
      {VIEW_OPTIONS.map(({ id, label, description, hotkey, icon: Icon }) => (
        <button
          className="relative flex flex-col gap-1 rounded-xl border border-border bg-surface/60 p-3 text-left hover:bg-secondary"
          key={id}
          onClick={() => {
            onOpen(id);
          }}
          type="button"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Icon size={16} />
            {label}
          </span>
          <span className="text-[13px] text-muted-foreground">{description}</span>
          <kbd className="absolute right-3 top-2.5 text-[11px] text-muted-foreground/60">
            {hotkey}
          </kbd>
        </button>
      ))}
    </div>
  </div>
);
