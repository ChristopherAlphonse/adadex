import { formatElapsed } from "../../app/factory/board";
import type { FactoryProcess } from "../../runtime/factoryHost";

type ProcessesPanelProps = {
  processes: readonly FactoryProcess[];
  nowMs: number;
  pendingKey: string | null;
  onKill: (key: string, processId: string) => void;
};

const processKey = (processId: string): string => `kill:${processId}`;

export const ProcessesPanel = ({ processes, nowMs, pendingKey, onKill }: ProcessesPanelProps) => {
  return (
    <section aria-label="Processes" className="rounded-lg border border-border bg-surface p-3">
      <h2 className="mb-2 text-[14px] font-semibold text-foreground">
        Processes
        <span className="ml-2 font-mono text-[11px] font-normal text-muted-foreground">
          {processes.length}
        </span>
      </h2>
      {processes.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">No running processes.</p>
      ) : (
        <ul className="space-y-2">
          {processes.map((process) => (
            <li
              key={process.processId}
              className="flex items-center justify-between gap-2 rounded border border-border bg-surface-2 px-2 py-1.5"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-[12px] text-foreground" title={process.label}>
                  {process.label}
                </p>
                <time dateTime={process.startedAt} className="text-[11px] text-muted-foreground">
                  {formatElapsed(process.startedAt, nowMs)}
                </time>
              </div>
              <button
                type="button"
                disabled={pendingKey === processKey(process.processId)}
                aria-label={`Kill process ${process.label}`}
                onClick={() => onKill(processKey(process.processId), process.processId)}
                className="shrink-0 rounded border border-destructive/60 bg-destructive/10 px-2 py-1 text-[12px] font-medium text-foreground hover:bg-destructive/20 disabled:opacity-50"
              >
                Kill
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
