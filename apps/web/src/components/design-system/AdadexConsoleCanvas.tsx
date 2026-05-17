import { Grid3x3, Minus, Plus, Scan } from "lucide-react";

import type { Agent, AgentStatus } from "./types";
import { StatusPill } from "./StatusPill";
import { statusToken } from "./statusColor";

type AdadexConsoleCanvasProps = {
  agents: Agent[];
  lead: Agent;
  selectedId: string;
  onSelect: (id: string) => void;
};

const LEGEND_STATUSES: AgentStatus[] = ["running", "stopped", "stale", "idle"];

export const AdadexConsoleCanvas = ({
  agents,
  lead,
  selectedId,
  onSelect,
}: AdadexConsoleCanvasProps): React.ReactElement => (
  <main className="bg-grid relative flex-1 overflow-hidden">
    <div className="scanline pointer-events-none absolute inset-0" />

    <svg className="absolute inset-0 size-full" preserveAspectRatio="none" aria-hidden>
      {agents
        .filter((a) => a.id !== lead.id)
        .map((a) => (
          <line
            key={a.id}
            x1={`${lead.x}%`}
            y1={`${lead.y}%`}
            x2={`${a.x}%`}
            y2={`${a.y}%`}
            stroke="oklch(1 0 0 / 0.12)"
            strokeWidth={1}
            strokeDasharray={a.status === "stale" ? "4 4" : undefined}
          />
        ))}
    </svg>

    {agents.map((a) => {
      const isLead = a.id === lead.id;
      const isSel = a.id === selectedId;
      const token = statusToken(a.status);
      return (
        <button
          key={a.id}
          type="button"
          onClick={() => onSelect(a.id)}
          className="absolute -translate-x-1/2 -translate-y-1/2 outline-none"
          style={{ left: `${a.x}%`, top: `${a.y}%` }}
        >
          <div className="flex flex-col items-center gap-2">
            <div
              className={`relative flex items-center justify-center rounded-full transition-all ${
                isLead ? "size-16" : "size-11"
              } ${isSel ? "scale-110" : "hover:scale-105"}`}
              style={{
                background: `oklch(from var(--${token}) l c h / 0.15)`,
                border: `2px ${a.status === "stale" ? "dashed" : "solid"} var(--${token})`,
                boxShadow:
                  isLead || isSel
                    ? `0 0 30px oklch(from var(--${token}) l c h / 0.35)`
                    : "none",
              }}
            >
              {isLead ? <div className="absolute inset-0 animate-pulse-ring rounded-full" /> : null}
              <div
                className={`rounded-full ${isLead ? "size-5" : "size-3"} ${
                  a.status === "running" ? "animate-pulse" : ""
                }`}
                style={{ backgroundColor: `var(--${token})` }}
              />
            </div>
            <div className="text-center">
              <p className="text-[12.5px] font-semibold tracking-tight text-foreground">{a.name}</p>
              <div className="mt-1.5 flex justify-center">
                <StatusPill status={a.status} />
              </div>
            </div>
          </div>
        </button>
      );
    })}

    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-border bg-surface/90 p-1 shadow-2xl backdrop-blur">
      <button
        type="button"
        className="flex items-center gap-1 rounded px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-white/5 hover:text-foreground"
      >
        <Minus className="size-3" strokeWidth={2} /> Zoom
      </button>
      <span className="px-1 font-mono text-[10px] text-muted-foreground">100%</span>
      <button
        type="button"
        className="flex items-center gap-1 rounded px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-white/5 hover:text-foreground"
      >
        <Plus className="size-3" strokeWidth={2} /> Zoom
      </button>
      <div className="mx-1 h-4 w-px bg-border" />
      <button
        type="button"
        className="flex items-center gap-1 rounded px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-white/5 hover:text-foreground"
      >
        <Scan className="size-3" strokeWidth={2} /> Fit
      </button>
      <button
        type="button"
        className="flex items-center gap-1 rounded px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-white/5 hover:text-foreground"
      >
        <Grid3x3 className="size-3" strokeWidth={2} /> Grid
      </button>
    </div>
    <div className="absolute right-4 top-4 rounded-lg border border-border bg-surface/80 p-3 backdrop-blur">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Legend
      </p>
      <div className="space-y-1.5">
        {LEGEND_STATUSES.map((s) => (
          <div key={s} className="flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ backgroundColor: `var(--${s})` }} />
            <span className="text-[12px] capitalize text-muted-foreground">{s}</span>
          </div>
        ))}
      </div>
    </div>
  </main>
);
