import { isString } from "@adadex/core";
import { useState } from "react";

import { cn } from "@/lib/utils";

import type { FactoryAction, FactoryBoardJob } from "../../app/factory/board";
import type { FactoryAuditCheck } from "../../runtime/factoryHost";

type FactoryJobCardProps = {
  entry: FactoryBoardJob;
  pendingKey: string | null;
  onAction: (key: string, action: FactoryAction) => void;
  onVerify: (jobId: string) => Promise<FactoryAuditCheck>;
};

const describeCheck = (check: FactoryAuditCheck): string =>
  check.ok
    ? `Audit chain intact (${check.entries} entries)`
    : `Audit chain broken: ${check.reason}`;

const actionKey = (jobId: string, action: FactoryAction): string => {
  const target = action.input.to;

  return isString(target) ? `${jobId}:${action.id}:${target}` : `${jobId}:${action.id}`;
};

export const FactoryJobCard = ({ entry, pendingKey, onAction, onVerify }: FactoryJobCardProps) => {
  const { job, actions } = entry;
  const [check, setCheck] = useState<FactoryAuditCheck | null>(null);

  const verify = () => {
    onVerify(job.id).then(setCheck, (cause: unknown) =>
      setCheck({ ok: false, reason: cause instanceof Error ? cause.message : "check failed" }),
    );
  };

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
        <button
          type="button"
          aria-label={`Check audit chain for ${job.title}`}
          onClick={verify}
          className="rounded border border-border bg-background px-2 py-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
        >
          Check audit
        </button>
      </div>
      {check !== null && (
        <output
          className={cn(
            "mt-2 block text-[12px]",
            check.ok ? "text-muted-foreground" : "text-destructive",
          )}
        >
          {describeCheck(check)}
        </output>
      )}
    </article>
  );
};
