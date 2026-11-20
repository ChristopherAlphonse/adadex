import { useMemo } from "react";

import { buildFactoryBoard, type FactoryAction } from "../../app/factory/board";
import { useFactoryHost } from "../../app/hooks/useFactoryHost";
import type { FactoryApproval, FactoryHost } from "../../runtime/factoryHost";
import { ApprovalCards } from "./ApprovalCards";
import { FactoryBoard } from "./FactoryBoard";
import { ProcessesPanel } from "./ProcessesPanel";

export const FactoryPrimaryView = ({ host }: { host: FactoryHost }) => {
  const {
    snapshot,
    isLoading,
    error,
    pendingKey,
    refresh,
    runAction,
    respondApproval,
    killProcess,
  } = useFactoryHost(host);
  const board = useMemo(
    () => buildFactoryBoard(snapshot.jobs, snapshot.workflows),
    [snapshot.jobs, snapshot.workflows],
  );
  const nowMs = Date.now();

  const handleAction = (key: string, action: FactoryAction) => {
    void runAction(key, action.id, action.input);
  };
  const handleRespond = (key: string, approval: FactoryApproval, approved: boolean) => {
    void respondApproval(key, approval.approvalId, approved);
  };

  return (
    <section
      aria-label="Factory primary view"
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-background p-5"
    >
      <header className="flex shrink-0 items-start justify-between gap-4">
        <div>
          <h1 className="text-[18px] font-semibold tracking-[0.08em] text-foreground">FACTORY</h1>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Jobs by stage. Every action is checked by the host before it runs.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground"
        >
          Refresh
        </button>
      </header>

      {!host.isAvailable() && (
        <p
          role="status"
          className="rounded border border-border bg-surface p-3 text-[12px] text-muted-foreground"
        >
          Factory host is not connected. Start the desktop app to run actions.
        </p>
      )}
      {error !== null && (
        <p
          role="alert"
          className="rounded border border-destructive/60 bg-destructive/10 p-3 text-[12px] text-foreground"
        >
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-[13px] text-muted-foreground">Loading factory…</p>
      ) : (
        <>
          <FactoryBoard
            columns={board.columns}
            placedJobs={board.placedJobs}
            pendingKey={pendingKey}
            onAction={handleAction}
          />
          <div className="grid shrink-0 gap-3 lg:grid-cols-2">
            <ApprovalCards
              approvals={snapshot.approvals}
              pendingKey={pendingKey}
              onRespond={handleRespond}
            />
            <ProcessesPanel
              processes={snapshot.processes}
              nowMs={nowMs}
              pendingKey={pendingKey}
              onKill={(key, processId) => void killProcess(key, processId)}
            />
          </div>
        </>
      )}
    </section>
  );
};
