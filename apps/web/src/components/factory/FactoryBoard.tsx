import type { FactoryAction, FactoryBoardColumn } from "../../app/factory/board";
import { FactoryJobCard } from "./FactoryJobCard";

type FactoryBoardProps = {
  columns: readonly FactoryBoardColumn[];
  placedJobs: number;
  pendingKey: string | null;
  onAction: (key: string, action: FactoryAction) => void;
};

export const FactoryBoard = ({ columns, placedJobs, pendingKey, onAction }: FactoryBoardProps) => {
  return (
    <section aria-label="Factory board" className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-[15px] font-semibold text-foreground">Board</h2>
        <span className="text-[12px] text-muted-foreground">{placedJobs} jobs</span>
      </div>
      {columns.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No workflows or jobs yet.</p>
      ) : (
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2">
          {columns.map((column) => (
            <section
              key={column.id}
              aria-label={`Stage ${column.title}`}
              className="flex min-w-[224px] flex-1 flex-col rounded-lg border border-border bg-background p-2"
            >
              <h3 className="mb-2 flex items-center justify-between px-1 text-[13px] font-semibold text-foreground">
                <span>{column.title}</span>
                <span className="font-mono text-[11px] font-normal text-muted-foreground">
                  {column.jobs.length}
                </span>
              </h3>
              <div className="space-y-2">
                {column.jobs.map((entry) => (
                  <FactoryJobCard
                    key={entry.job.id}
                    entry={entry}
                    pendingKey={pendingKey}
                    onAction={onAction}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
};
