import {
  EyeOff,
  GitBranch,
  Maximize2,
  Network,
  RefreshCw,
  Settings2,
  TerminalSquare,
} from "lucide-react";

type ConsoleChromeToolbarProps = {
  hideIdle: boolean;
  onToggleHideIdle: () => void;
  onCreateTerminal?: () => void;
  onCreateWorktreeTerminal?: () => void;
  onCreateOrchestration?: () => void;
  onFitView?: () => void;
  onRefresh?: () => void;
  onDeleteAll?: () => void;
  onNewAgent?: () => void;
  showSetup?: boolean;
  onShowSetup?: () => void;
};

const TOOLBAR_ACTIONS = [
  { id: "terminal", label: "Terminal", icon: TerminalSquare },
  { id: "worktree", label: "Worktree", icon: GitBranch },
  { id: "orchestration", label: "Orchestration", icon: Network },
  { id: "fit", label: "Fit", icon: Maximize2 },
  { id: "refresh", label: "Refresh", icon: RefreshCw },
  { id: "hide-idle", label: "Hide Idle", icon: EyeOff },
  { id: "setup", label: "Setup", icon: Settings2 },
] as const;

export const ConsoleChromeToolbar = ({
  hideIdle,
  onToggleHideIdle,
  onCreateTerminal,
  onCreateWorktreeTerminal,
  onCreateOrchestration,
  onFitView,
  onRefresh,
  onDeleteAll,
  onNewAgent,
  showSetup = false,
  onShowSetup,
}: ConsoleChromeToolbarProps): React.ReactElement => {
  const handleAction = (id: (typeof TOOLBAR_ACTIONS)[number]["id"]): void => {
    switch (id) {
      case "terminal":
        onCreateTerminal?.();
        break;
      case "worktree":
        onCreateWorktreeTerminal?.();
        break;
      case "orchestration":
        onCreateOrchestration?.();
        break;
      case "fit":
        onFitView?.();
        break;
      case "refresh":
        onRefresh?.();
        break;
      case "hide-idle":
        onToggleHideIdle();
        break;
      case "setup":
        onShowSetup?.();
        break;
      default:
        break;
    }
  };

  return (
    <div className="flex h-11 shrink-0 items-center gap-1 border-b border-border bg-surface/30 px-4">
      <div className="flex items-center gap-0.5">
        {TOOLBAR_ACTIONS.map((action) => {
          if (action.id === "setup" && !showSetup) return null;
          const isHideIdle = action.id === "hide-idle";
          const active = isHideIdle && hideIdle;
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => handleAction(action.id)}
              className={`flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium transition-colors ${
                active
                  ? "bg-brand/10 text-brand"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5" strokeWidth={2} />
              {isHideIdle && hideIdle ? "Show Idle" : action.label}
            </button>
          );
        })}
        <div className="mx-1.5 h-4 w-px bg-border" />
        <button
          type="button"
          onClick={onDeleteAll}
          className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          <svg
            className="size-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path d="M3 6h18" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          Delete all
        </button>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <span className="size-1.5 animate-pulse rounded-full bg-running" />
          <span>Auto-refresh in 12s</span>
        </div>
        <div className="mx-1 h-4 w-px bg-border" />
        <button
          type="button"
          onClick={onNewAgent ?? onCreateTerminal}
          className="flex h-7 items-center gap-1.5 rounded-md bg-foreground px-3 text-[12.5px] font-semibold text-background transition-opacity hover:opacity-90"
        >
          <svg
            className="size-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden
          >
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
          New agent
        </button>
      </div>
    </div>
  );
};
