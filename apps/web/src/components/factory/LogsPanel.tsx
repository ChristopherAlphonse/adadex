import type { FactoryLogEvent } from "../../runtime/factoryHost";

const levelClass = (level: string): string =>
  level === "error"
    ? "text-destructive"
    : level === "warn"
      ? "text-stopped"
      : "text-muted-foreground";

export const LogsPanel = ({ logs }: { logs: readonly FactoryLogEvent[] }) => (
  <section aria-label="Logs" className="rounded-lg border border-border bg-surface p-3">
    <h2 className="mb-2 text-[14px] font-semibold text-foreground">
      Logs
      <span className="ml-2 font-mono text-[11px] font-normal text-muted-foreground">
        newest {logs.length}
      </span>
    </h2>
    {logs.length === 0 ? (
      <p className="text-[12px] text-muted-foreground">No events yet.</p>
    ) : (
      <ol className="max-h-80 space-y-1 overflow-y-auto font-mono text-[11px]">
        {logs.map((event) => (
          <li key={event.id} className="flex gap-2">
            <time dateTime={event.ts} className="shrink-0 text-muted-foreground">
              {event.ts.slice(11, 19)}
            </time>
            <span className={levelClass(event.level)}>{event.level}</span>
            <span className="shrink-0 text-muted-foreground">{event.source}</span>
            <span className="min-w-0 break-words text-foreground">
              {event.jobId !== undefined && `[${event.jobId}] `}
              {event.message}
            </span>
          </li>
        ))}
      </ol>
    )}
  </section>
);
