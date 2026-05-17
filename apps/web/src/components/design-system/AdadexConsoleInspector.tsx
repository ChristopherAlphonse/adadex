import { Bar, KV, Section } from "./ConsolePrimitives";
import { DEMO_LOGS } from "./data";
import { StatusPill } from "./StatusPill";
import type { Agent } from "./types";

const memoryBarValue = (mem: string): number => {
  if (mem === "0 MB") return 0;
  const parsed = Number.parseFloat(mem);
  if (Number.isNaN(parsed)) return 18;
  return parsed > 1 ? 45 : 18;
};

type AdadexConsoleInspectorProps = {
  agent: Agent;
};

export const AdadexConsoleInspector = ({
  agent,
}: AdadexConsoleInspectorProps): React.ReactElement => (
  <aside className="flex w-[360px] shrink-0 flex-col border-l border-border bg-surface/40">
    <div className="border-b border-border p-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Inspector
        </p>
        <span className="font-mono text-[11px] text-muted-foreground">{agent.id}</span>
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <h2 className="text-[16px] font-semibold tracking-tight text-foreground">{agent.name}</h2>
        <StatusPill status={agent.status} />
      </div>
    </div>

    <div className="flex-1 overflow-y-auto">
      <Section title="Metadata">
        <div className="space-y-1">
          <KV label="Branch" value={agent.branch} mono />
          <KV label="Worktree" value={agent.worktree} mono />
          <KV label="Commit" value={agent.commit} mono />
          <KV label="Uptime" value={agent.uptime} mono />
        </div>
      </Section>

      <Section title="Resources">
        <div className="space-y-3.5">
          <Bar label="CPU" value={agent.cpu} suffix={`${agent.cpu}%`} />
          <Bar label="Memory" value={memoryBarValue(agent.mem)} suffix={agent.mem} />
          <Bar label="Tokens" value={28} suffix={agent.tokens} />
        </div>
      </Section>

      <Section title="Diff Summary">
        <div className="space-y-1.5 rounded-md border border-border bg-background/60 p-3 font-mono text-[12px] leading-relaxed">
          <div className="flex items-center justify-between">
            <span className="text-foreground/80">core/engine.ts</span>
            <span className="text-running">+142</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-foreground/80">utils/compat.ts</span>
            <span className="text-stopped">−28</span>
          </div>
          <div className="border-t border-border pt-1.5 text-[11px] text-muted-foreground">
            4 files changed · 2 staged
          </div>
        </div>
      </Section>

      <Section title="Stream Logs">
        <div className="h-48 overflow-y-auto rounded-md border border-border bg-background/70 p-3 font-mono text-[11.5px] leading-[1.6]">
          {DEMO_LOGS.map((l) => (
            <div key={`${l.t}-${l.msg}`} className="flex gap-2">
              <span className="shrink-0 text-muted-foreground/60">{l.t}</span>
              <span
                className={
                  l.level === "warn"
                    ? "text-stale"
                    : l.level === "error"
                      ? "text-stopped"
                      : l.level === "ok"
                        ? "text-running"
                        : "text-foreground/85"
                }
              >
                {l.msg}
              </span>
            </div>
          ))}
          <div className="mt-1 flex items-center gap-1 text-brand">
            <span>›</span>
            <span className="h-3 w-1.5 animate-pulse bg-brand" />
          </div>
        </div>
      </Section>
    </div>

    <div className="border-t border-border p-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="flex h-9 items-center justify-center rounded-md border border-border bg-white/5 text-[13px] font-medium text-foreground transition-colors hover:bg-white/10"
        >
          Attach
        </button>
        <button
          type="button"
          className="flex h-9 items-center justify-center rounded-md bg-foreground text-[13px] font-semibold text-background transition-opacity hover:opacity-90"
        >
          Deploy
        </button>
      </div>
    </div>
  </aside>
);
