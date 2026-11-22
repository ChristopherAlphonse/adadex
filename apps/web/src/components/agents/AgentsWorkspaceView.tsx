import { ChevronUp, ListTodo, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useConversationChat } from "../../app/hooks/useConversationChat";
import { useWorkspaceSetupOverlay } from "../../app/hooks/useWorkspaceSetupOverlay";
import { sendChannelMessage } from "../../app/sendChannelMessage";
import { AgentStateBadge } from "../AgentStateBadge";
import { type CanvasPrimaryViewProps, CanvasPrimaryView } from "../CanvasPrimaryView";
import { WorkspaceSetupCard } from "../deck/WorkspaceSetupCard";
import { DeleteOrchestrationDialog } from "../DeleteOrchestrationDialog";
import { TerminalChatPane } from "../TerminalChatPane";
import { AgentsRail } from "./AgentsRail";
import { type ChatWorkbenchPanel, ChatWorkbench } from "./ChatWorkbench";

const CLOCK_TICK_MS = 30_000;

export const AgentsWorkspaceView = (props: CanvasPrimaryViewProps) => {
  const {
    columns,
    onCreateTerminal,
    onCreateAgent,
    onCreateWorktreeTerminal,
    onOpenGitActions,
    onCloseActiveSession,
    onDeleteActiveSession,
    pendingDeleteTerminal,
    isDeletingTerminalId,
    onCancelDelete,
    onConfirmDelete,
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
  const [isGraphOpen, setIsGraphOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [isLaunchingPlanner, setIsLaunchingPlanner] = useState(false);
  const [panel, setPanel] = useState<ChatWorkbenchPanel | null>(null);
  const [sideChatDraft, setSideChatDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const chatViewportRef = useRef<HTMLDivElement | null>(null);

  const {
    shouldShow: shouldShowSetup,
    overlay: setupOverlay,
    setOverlay: setSetupOverlay,
    incompleteSteps,
  } = useWorkspaceSetupOverlay(workspaceSetup);

  const selected = columns.find((session) => session.terminalId === selectedId) ?? null;
  const messages = useConversationChat(selected?.terminalId ?? null, null);

  const select = (terminalId: string) => {
    setSelectedId(terminalId);
    setActionError(null);
  };

  const launchPlanner = async () => {
    if (!onLaunchWorkspaceSetupPlanner) return;

    setIsLaunchingPlanner(true);

    try {
      const id = await onLaunchWorkspaceSetupPlanner();

      if (id) select(id);
    } finally {
      setIsLaunchingPlanner(false);
    }
  };

  const bringBack = async (text: string) => {
    if (!selectedId) return;

    try {
      await sendChannelMessage(selectedId, text);
      setActionError(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to bring the answer back.");
    }
  };

  const delegate = async () => {
    if (!onCreateAgent || !selected) return;

    try {
      const id = await onCreateAgent(selected.coordinationId, selected.terminalId);

      if (id) select(id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to delegate.");
    }
  };

  const createWorktree = async () => {
    if (!onCreateWorktreeTerminal) return;

    try {
      const id = await onCreateWorktreeTerminal();

      if (id) select(id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to create the worktree.");
    }
  };

  const scrollToBottom = () => {
    const viewport = chatViewportRef.current;

    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
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

  return (
    <section aria-label="Agents workspace" className="flex min-h-0 min-w-0 flex-1">
      <AgentsRail
        now={now}
        onCreateAgent={
          onCreateTerminal
            ? () => {
                void Promise.resolve(onCreateTerminal()).then((id) => {
                  if (id) select(id);
                });
              }
            : undefined
        }
        isGraphOpen={isGraphOpen}
        onClose={
          onCloseActiveSession
            ? (session) => {
                void onCloseActiveSession(
                  session.terminalId,
                  session.coordinationName || session.label,
                  session.workspaceMode,
                );

                if (session.terminalId === selectedId) setSelectedId(null);
              }
            : undefined
        }
        onDelete={
          onDeleteActiveSession
            ? (session) => {
                onDeleteActiveSession(
                  session.terminalId,
                  session.coordinationName || session.label,
                  session.workspaceMode,
                );
              }
            : undefined
        }
        onSelect={select}
        onToggleGraph={() => {
          setIsGraphOpen((open) => !open);
        }}
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
            {actionError ? (
              <p
                className="m-0 border-b border-border px-4 py-1 text-xs text-destructive"
                role="alert"
              >
                {actionError}
              </p>
            ) : null}
            <ChatWorkbench
              columns={columns}
              messages={messages}
              onBringBack={(text) => {
                void bringBack(text);
              }}
              onDelegate={onCreateAgent ? () => void delegate() : undefined}
              onCreateWorktree={onCreateWorktreeTerminal ? () => void createWorktree() : undefined}
              onOpenGit={
                onOpenGitActions ? () => onOpenGitActions(selected.coordinationId) : undefined
              }
              onPanelChange={setPanel}
              onScrollToBottom={scrollToBottom}
              onSelectSession={select}
              onSideChatDraftChange={setSideChatDraft}
              panel={panel}
              session={selected}
              sideChatDraft={sideChatDraft}
            />
            <div className="min-h-0 flex-1 overflow-y-auto" ref={chatViewportRef}>
              <TerminalChatPane
                key={selected.terminalId}
                terminalId={selected.terminalId}
                terminalLabel={selected.label}
                {...(onTerminalRenamed ? { onTerminalRenamed } : {})}
                {...(onTerminalActivity ? { onTerminalActivity } : {})}
                onSideChatRequest={(draft) => {
                  setSideChatDraft(draft);
                  setPanel("side");
                }}
              />
            </div>
          </>
        ) : (
          <p className="m-auto text-sm text-muted-foreground">Select a session to see its chat.</p>
        )}
      </div>

      {isGraphOpen ? (
        <aside
          aria-label="Graph view"
          className="flex min-h-0 w-[min(60%,56rem)] shrink-0 flex-col border-l border-border bg-surface/40"
        >
          <button
            aria-label="Close graph"
            className="ml-auto mr-2 mt-2 grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
            onClick={() => {
              setIsGraphOpen(false);
            }}
            type="button"
          >
            <X size={14} />
          </button>
          <div className="flex min-h-0 flex-1">
            <CanvasPrimaryView {...props} pendingDeleteTerminal={null} workspaceSetup={null} />
          </div>
        </aside>
      ) : null}
      {pendingDeleteTerminal && onCancelDelete && onConfirmDelete ? (
        <div className="canvas-delete-dialog">
          <DeleteOrchestrationDialog
            isDeletingTerminalId={isDeletingTerminalId ?? null}
            onCancel={onCancelDelete}
            onConfirmDelete={onConfirmDelete}
            pendingDeleteTerminal={pendingDeleteTerminal}
          />
        </div>
      ) : null}
    </section>
  );
};
