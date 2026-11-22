import { ChevronDown, ChevronRight, GitBranch, Network, Plus, Star, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

import type { TerminalView } from "../../app/types";

type Session = TerminalView[number];

type AgentsRailProps = {
  sessions: TerminalView;
  groupNames: ReadonlyMap<string, string>;
  selectedId: string | null;
  now: number;
  onSelect: (terminalId: string) => void;
  onCreateAgent?: (() => void) | undefined;
  isGraphOpen: boolean;
  onToggleGraph: () => void;
  onClose?: ((session: Session) => void) | undefined;
  onDelete?: ((session: Session) => void) | undefined;
  pinnedIds: ReadonlySet<string>;
  onTogglePin: (terminalId: string) => void;
};

const NEEDS_YOU_STATES = new Set(["waiting_for_permission", "waiting_for_user"]);

const formatAge = (session: Session, now: number): string => {
  const minutes = Math.floor((now - Date.parse(session.startedAt ?? session.createdAt)) / 60_000);

  if (!Number.isFinite(minutes) || minutes < 1) {
    return "now";
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);

  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
};

const dotClass = (session: Session): string => {
  if (session.agentRuntimeState && NEEDS_YOU_STATES.has(session.agentRuntimeState)) {
    return "bg-stopped";
  }

  if (session.agentRuntimeState === "processing" || session.state === "live") {
    return "bg-running";
  }

  return "bg-muted-foreground/40";
};

const DECK_LEAD_ID = "__deck_lead__";

export const groupLabel = (coordinationId: string, names: ReadonlyMap<string, string>): string =>
  names.get(coordinationId) ?? (coordinationId === DECK_LEAD_ID ? "Deck lead" : coordinationId);

const sessionName = (session: Session): string =>
  session.coordinationName || session.label || session.terminalId;

type TreeRow = { session: Session; depth: number };

const flattenGroup = (group: Session[]): TreeRow[] => {
  const ids = new Set(group.map((session) => session.terminalId));
  const children = new Map<string, Session[]>();
  const roots: Session[] = [];

  for (const session of group) {
    const parent = session.parentTerminalId;

    if (parent && ids.has(parent)) {
      children.set(parent, [...(children.get(parent) ?? []), session]);
    } else {
      roots.push(session);
    }
  }

  const rows: TreeRow[] = [];

  const walk = (session: Session, depth: number) => {
    rows.push({ session, depth });

    for (const child of children.get(session.terminalId) ?? []) {
      walk(child, depth + 1);
    }
  };

  for (const root of roots) {
    walk(root, 0);
  }

  return rows;
};

const PARKED_STATES = new Set(["stopped", "exited", "stale"]);

type SessionRowProps = {
  session: Session;
  depth: number;
  now: number;
  isSelected: boolean;
  isPinned: boolean;
  onSelect: (terminalId: string) => void;
  onTogglePin: (terminalId: string) => void;
  onClose?: ((session: Session) => void) | undefined;
  onDelete?: ((session: Session) => void) | undefined;
};

const ACTION_BUTTON =
  "grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-background";

const SessionRow = ({
  session,
  depth,
  now,
  isSelected,
  isPinned,
  onSelect,
  onTogglePin,
  onClose,
  onDelete,
}: SessionRowProps) => (
  <div
    className={cn(
      "group/row flex items-center rounded-md pr-1 hover:bg-secondary",
      isSelected && "bg-secondary",
    )}
  >
    <button
      aria-current={isSelected ? "true" : undefined}
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-1 text-left text-sm",
        isSelected ? "text-foreground" : "text-muted-foreground",
      )}
      onClick={() => {
        onSelect(session.terminalId);
      }}
      style={{ paddingLeft: `${22 + depth * 14}px` }}
      type="button"
    >
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", dotClass(session))} />
      <span className="min-w-0 flex-1 truncate">{sessionName(session)}</span>
      {session.workspaceMode === "worktree" ? (
        <GitBranch aria-label="Worktree" className="shrink-0" size={12} />
      ) : null}
      {isPinned ? <Star aria-label="Pinned" className="shrink-0 fill-current" size={12} /> : null}
      <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground group-focus-within/row:hidden group-hover/row:hidden">
        {formatAge(session, now)}
      </span>
    </button>
    <span className="hidden shrink-0 items-center gap-0.5 group-focus-within/row:flex group-hover/row:flex">
      <button
        aria-label={`${isPinned ? "Unpin" : "Pin"} ${sessionName(session)}`}
        aria-pressed={isPinned}
        className={cn(ACTION_BUTTON, "hover:text-foreground")}
        onClick={() => {
          onTogglePin(session.terminalId);
        }}
        title={isPinned ? "Unpin" : "Pin to top"}
        type="button"
      >
        <Star className={isPinned ? "fill-current" : undefined} size={13} />
      </button>
      {onClose ? (
        <button
          aria-label={`Close ${sessionName(session)}`}
          className={cn(ACTION_BUTTON, "hover:text-foreground")}
          onClick={() => {
            onClose(session);
          }}
          title="Close session"
          type="button"
        >
          <X size={13} />
        </button>
      ) : null}
      {onDelete ? (
        <button
          aria-label={`Delete ${sessionName(session)}`}
          className={cn(ACTION_BUTTON, "hover:text-destructive")}
          onClick={() => {
            onDelete(session);
          }}
          title="Delete session"
          type="button"
        >
          <Trash2 size={13} />
        </button>
      ) : null}
    </span>
  </div>
);

export const AgentsRail = ({
  sessions,
  groupNames,
  selectedId,
  now,
  onSelect,
  onCreateAgent,
  isGraphOpen,
  onToggleGraph,
  onClose,
  onDelete,
  pinnedIds,
  onTogglePin,
}: AgentsRailProps) => {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [expandedParked, setExpandedParked] = useState<ReadonlySet<string>>(new Set());

  const pinnedSessions = useMemo(
    () => sessions.filter((session) => pinnedIds.has(session.terminalId)),
    [sessions, pinnedIds],
  );

  const groups = useMemo(() => {
    const byCoordination = new Map<string, Session[]>();

    for (const session of sessions) {
      if (pinnedIds.has(session.terminalId)) continue;

      byCoordination.set(session.coordinationId, [
        ...(byCoordination.get(session.coordinationId) ?? []),
        session,
      ]);
    }

    return Array.from(byCoordination, ([coordinationId, group]) => ({
      coordinationId,
      label: groupLabel(coordinationId, groupNames),
      rows: flattenGroup(group.filter((session) => !PARKED_STATES.has(session.state))),
      parkedRows: flattenGroup(group.filter((session) => PARKED_STATES.has(session.state))),
      needsYou: group.filter(
        (session) => session.agentRuntimeState && NEEDS_YOU_STATES.has(session.agentRuntimeState),
      ).length,
    })).sort((a, b) => {
      if (a.coordinationId === DECK_LEAD_ID) return -1;

      if (b.coordinationId === DECK_LEAD_ID) return 1;

      return a.label.localeCompare(b.label);
    });
  }, [sessions, groupNames, pinnedIds]);

  const toggleParked = (coordinationId: string) => {
    setExpandedParked((current) => {
      const next = new Set(current);

      if (next.has(coordinationId)) {
        next.delete(coordinationId);
      } else {
        next.add(coordinationId);
      }

      return next;
    });
  };

  const renderRow = ({ session, depth }: TreeRow) => (
    <SessionRow
      depth={depth}
      isPinned={pinnedIds.has(session.terminalId)}
      isSelected={session.terminalId === selectedId}
      key={session.terminalId}
      now={now}
      onClose={onClose}
      onDelete={onDelete}
      onSelect={onSelect}
      onTogglePin={onTogglePin}
      session={session}
    />
  );

  const toggle = (coordinationId: string) => {
    setCollapsed((current) => {
      const next = new Set(current);

      if (next.has(coordinationId)) {
        next.delete(coordinationId);
      } else {
        next.add(coordinationId);
      }

      return next;
    });
  };

  return (
    <aside
      aria-label="Agent sessions"
      className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-surface/60"
    >
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
          Sessions
        </span>
        <div className="flex items-center gap-0.5">
          <button
            aria-label={isGraphOpen ? "Close graph" : "Open graph"}
            aria-pressed={isGraphOpen}
            className={cn(
              "grid size-6 place-items-center rounded-md hover:bg-secondary hover:text-foreground",
              isGraphOpen ? "bg-secondary text-foreground" : "text-muted-foreground",
            )}
            onClick={onToggleGraph}
            title="Graph"
            type="button"
          >
            <Network size={14} />
          </button>
          {onCreateAgent ? (
            <button
              aria-label="New agent"
              className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
              onClick={onCreateAgent}
              type="button"
            >
              <Plus size={14} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        {sessions.length === 0 ? (
          <p className="m-0 px-2 py-3 text-sm text-muted-foreground">
            No agents yet. Create one to get started.
          </p>
        ) : null}

        {pinnedSessions.length > 0 ? (
          <section className="mb-1.5">
            <h3 className="m-0 px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Pinned
            </h3>
            {pinnedSessions.map((session) => renderRow({ session, depth: 0 }))}
          </section>
        ) : null}

        {groups.map((group) => {
          const isCollapsed = collapsed.has(group.coordinationId);
          const Chevron = isCollapsed ? ChevronRight : ChevronDown;

          const hasSelectedParked = group.parkedRows.some(
            ({ session }) => session.terminalId === selectedId,
          );

          const isParkedOpen = expandedParked.has(group.coordinationId) || hasSelectedParked;

          return (
            <section className="mb-1.5" key={group.coordinationId}>
              <button
                aria-expanded={!isCollapsed}
                className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-sm font-medium text-foreground hover:bg-secondary"
                onClick={() => {
                  toggle(group.coordinationId);
                }}
                type="button"
              >
                <Chevron className="shrink-0 text-muted-foreground" size={14} />
                <span className="min-w-0 flex-1 truncate">{group.label}</span>
                {group.needsYou > 0 ? (
                  <span className="rounded-full bg-stopped/20 px-1.5 text-[11px] text-stopped">
                    {group.needsYou}
                  </span>
                ) : null}
              </button>

              {isCollapsed ? null : (
                <>
                  {group.rows.map(renderRow)}
                  {group.parkedRows.length > 0 ? (
                    <>
                      <button
                        aria-expanded={isParkedOpen}
                        className="flex w-full items-center gap-1 rounded-md py-1 pl-[22px] pr-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-secondary"
                        onClick={() => {
                          toggleParked(group.coordinationId);
                        }}
                        type="button"
                      >
                        <span className="flex-1">Parked</span>
                        <span className="tabular-nums">{group.parkedRows.length}</span>
                      </button>
                      {isParkedOpen ? group.parkedRows.map(renderRow) : null}
                    </>
                  ) : null}
                </>
              )}
            </section>
          );
        })}
      </div>
    </aside>
  );
};
