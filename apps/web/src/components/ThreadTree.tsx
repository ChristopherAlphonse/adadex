import {
  type TerminalSnapshot,
  type ThreadNode,
  type ThreadStatus,
  buildThreadTree,
} from "@adadex/core";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

type ThreadTreeProps = {
  terminals: readonly TerminalSnapshot[];
  now?: number;
};

const STATUS_LABEL: Record<ThreadStatus, string> = {
  working: "Working",
  "needs-you": "Needs you",
  done: "Done",
  idle: "Idle",
};

const STATUS_TONE: Record<ThreadStatus, string> = {
  working: "text-running",
  "needs-you": "text-stopped font-medium",
  done: "text-muted-foreground",
  idle: "text-muted-foreground",
};

const formatAge = (createdAt: string, now: number): string => {
  const minutes = Math.floor((now - Date.parse(createdAt)) / 60_000);

  if (!Number.isFinite(minutes) || minutes < 1) {
    return "now";
  }

  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h`;
};

const ThreadRow = ({ node, now, depth }: { node: ThreadNode; now: number; depth: number }) => (
  <li>
    <div
      className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-[13px] hover:bg-surface-2"
      style={{ paddingLeft: `${8 + depth * 16}px` }}
    >
      <span className="truncate text-foreground">{node.label}</span>
      <span className="flex shrink-0 items-center gap-2 text-xs">
        <span className={cn(STATUS_TONE[node.status])}>{STATUS_LABEL[node.status]}</span>
        <span className="text-muted-foreground">{formatAge(node.createdAt, now)}</span>
      </span>
    </div>
    {node.children.length > 0 ? (
      <ul className="m-0 list-none p-0">
        {node.children.map((child) => (
          <ThreadRow depth={depth + 1} key={child.terminalId} node={child} now={now} />
        ))}
      </ul>
    ) : null}
  </li>
);

const countWaiting = (nodes: readonly ThreadNode[]): number =>
  nodes.reduce(
    (sum, node) => sum + (node.status === "needs-you" ? 1 : 0) + countWaiting(node.children),
    0,
  );

/** Agents as a tree: a parent agent with the child agents it started nested under it, each with its status. */
export const ThreadTree = ({ terminals, now }: ThreadTreeProps) => {
  const [clock, setClock] = useState(() => now ?? Date.now());

  useEffect(() => {
    if (now !== undefined) {
      return undefined;
    }

    const timer = setInterval(() => {
      setClock(Date.now());
    }, 30_000);

    return () => {
      clearInterval(timer);
    };
  }, [now]);

  const roots = useMemo(() => buildThreadTree(terminals), [terminals]);
  const waiting = countWaiting(roots);

  if (roots.length === 0) {
    return null;
  }

  return (
    <section aria-label="Threads" className="border-b border-border px-2 py-2">
      <p className="m-0 flex items-center justify-between px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        <span>Threads</span>
        {waiting > 0 ? <span className="text-stopped">{waiting} need you</span> : null}
      </p>
      <ul className="m-0 list-none p-0">
        {roots.map((node) => (
          <ThreadRow depth={0} key={node.terminalId} node={node} now={now ?? clock} />
        ))}
      </ul>
    </section>
  );
};
