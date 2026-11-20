import { cn } from "@/lib/utils";

import type { FactoryAction, FactoryBoardJob } from "../../app/factory/board";

type FactoryJobCardProps = {
  entry: FactoryBoardJob;
  pendingKey: string | null;
  onAction: (key: string, action: FactoryAction) => void;
};

const actionKey = (jobId: string, action: FactoryAction): string => {
  const target = action.input.to;
  return typeof target === "string" ? `${jobId}:${action.id}:${target}` : `${jobId}:${action.id}`;
};

export const FactoryJobCard = ({ entry, pendingKey, onAction }: FactoryJobCardProps) => {
  const { job, actions } = entry;
  return (
    <article
      aria-label={`Job ${job.title}`}
      className="rounded-lg border border-border bg-surface-2 p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[14px] font-medium text-foreground">{job.title}</h3>
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
          R{job.round}/{job.roundLimit}
        </span>
      </div>
      {job.worktree !== undefined && (
        <p
          className="mt-1 truncate font-mono text-[11px] text-muted-foreground"
          title={job.worktree}
        >
          {job.worktree}
        </p>
      )}
      {job.parkedFrom !== undefined && (
        <p className="mt-1 text-[12px] text-stopped">Parked from {job.parkedFrom}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {actions.map((action) => {
          const key = actionKey(job.id, action);
          return (
            <button
              key={key}
              type="button"
              disabled={pendingKey === key}
              aria-label={`${action.label} for ${job.title}`}
              onClick={() => onAction(key, action)}
              className={cn(
                "rounded border px-2 py-1 text-[12px] font-medium transition-colors disabled:opacity-50",
                action.isHuman
                  ? "border-primary/60 bg-primary/10 text-foreground hover:bg-primary/20"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {action.label}
            </button>
          );
        })}
      </div>
    </article>
  );
};
