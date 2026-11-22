import { ChevronUp, ListTodo, X } from "lucide-react";
import { useEffect, useState } from "react";

import { useWorkspaceSetupOverlay } from "../../app/hooks/useWorkspaceSetupOverlay";
import { AgentStateBadge } from "../AgentStateBadge";
import { type CanvasPrimaryViewProps, CanvasPrimaryView } from "../CanvasPrimaryView";
import { WorkspaceSetupCard } from "../deck/WorkspaceSetupCard";
import { TerminalChatPane } from "../TerminalChatPane";
import { AgentsRail } from "./AgentsRail";
import { type AgentsViewId, AgentsViewPicker } from "./AgentsViewPicker";

const CLOCK_TICK_MS = 30_000;

export const AgentsWorkspaceView = (props: CanvasPrimaryViewProps) => {
  const {
    columns,
    onCreateTerminal,
    onTerminalRenamed,
    onTerminalActivity,
    workspaceSetup = null,
    isWorkspaceSetupLoading = false,
    workspaceSetupError = null,
    runningWorkspaceSetupStepId = null,
    onRunWorkspaceSetupStep,
    onLaunchWorkspaceSetupPlanner,
  } = props;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openView, setOpenView] = useState<AgentsViewId | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isLaunchingPlanner, setIsLaunchingPlanner] = useState(false);

  const {
    shouldShow: shouldShowSetup,
    overlay: setupOverlay,
    setOverlay: setSetupOverlay,
    incompleteSteps,
  } = useWorkspaceSetupOverlay(workspaceSetup);

  const launchPlanner = async () => {
    if (!onLaunchWorkspaceSetupPlanner) return;

    setIsLaunchingPlanner(true);

    try {
      const id = await onLaunchWorkspaceSetupPlanner();

      if (id) setSelectedId(id);
    } finally {
      setIsLaunchingPlanner(false);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, CLOCK_TICK_MS);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const selected = columns.find((session) => session.terminalId === selectedId) ?? null;

  return (
    <section aria-label="Agents workspace" className="flex min-h-0 min-w-0 flex-1">
      <AgentsRail
        now={now}
        onCreateAgent={
          onCreateTerminal
            ? () => {
                void Promise.resolve(onCreateTerminal()).then((id) => {
                  if (id) setSelectedId(id);
                });
              }
            : undefined
        }
        onSelect={setSelectedId}
        selectedId={selected?.terminalId ?? null}
        sessions={columns}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {shouldShowSetup && setupOverlay === "expanded" ? (
          <div className="p-3">
            <WorkspaceSetupCard
              error={workspaceSetupError}
              isLaunchingAgent={isLaunchingPlanner}
              isLoading={isWorkspaceSetupLoading}
              isRunningStepId={runningWorkspaceSetupStepId}
              onDismiss={() => {
                setSetupOverlay("hidden");
              }}
              onLaunchAgent={() => {
                void launchPlanner();
              }}
              onMinimize={() => {
                setSetupOverlay("minimized");
              }}
              onRunStep={(stepId) => {
                void onRunWorkspaceSetupStep?.(stepId);
              }}
              workspaceSetup={workspaceSetup}
            />
          </div>
        ) : null}
        {shouldShowSetup && setupOverlay === "minimized" ? (
          <button
            aria-label={
              incompleteSteps > 0
                ? `Expand workspace setup, ${incompleteSteps} steps incomplete`
                : "Expand workspace setup"
            }
            className="workspace-setup-minimized-bar m-3"
            onClick={() => {
              setSetupOverlay("expanded");
            }}
            type="button"
          >
            <ListTodo aria-hidden size={16} strokeWidth={2} />
            <span className="workspace-setup-minimized-bar-label">
              Workspace setup{incompleteSteps > 0 ? ` · ${incompleteSteps} incomplete` : ""}
            </span>
            <ChevronUp aria-hidden size={16} strokeWidth={2} />
          </button>
        ) : null}
        {selected ? (
          <>
            <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
              <h2 className="m-0 min-w-0 truncate text-sm font-semibold text-foreground">
                {selected.coordinationName || selected.label}
              </h2>
              {selected.agentRuntimeState ? (
                <AgentStateBadge state={selected.agentRuntimeState} />
              ) : null}
            </header>
            <div className="min-h-0 flex-1">
              <TerminalChatPane
                key={selected.terminalId}
                terminalId={selected.terminalId}
                terminalLabel={selected.label}
                {...(onTerminalRenamed ? { onTerminalRenamed } : {})}
                {...(onTerminalActivity ? { onTerminalActivity } : {})}
              />
            </div>
          </>
        ) : (
          <p className="m-auto text-sm text-muted-foreground">Select a session to see its chat.</p>
        )}
      </div>

      <aside
        aria-label="Views"
        className="flex min-h-0 w-[28rem] shrink-0 flex-col border-l border-border bg-surface/40"
        style={openView ? { width: "min(60%, 56rem)" } : undefined}
      >
        {openView === "graph" ? (
          <>
            <button
              aria-label="Close view"
              className="ml-auto mr-2 mt-2 grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
              onClick={() => {
                setOpenView(null);
              }}
              type="button"
            >
              <X size={14} />
            </button>
            <div className="flex min-h-0 flex-1">
              <CanvasPrimaryView {...props} workspaceSetup={null} />
            </div>
          </>
        ) : (
          <AgentsViewPicker onOpen={setOpenView} />
        )}
      </aside>
    </section>
  );
};
