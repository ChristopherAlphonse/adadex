import type { CoordinationWorkspaceMode, DeckCoordinationSummary } from "@adadex/core";
import { useState } from "react";

import { cn } from "../../lib/utils";
import { MascotSprite } from "../MascotSprite";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import type { MascotVisuals } from "./mascotVisuals";

const STATUS_LABELS: Record<DeckCoordinationSummary["status"], string> = {
  idle: "Idle",
  active: "Active",
  blocked: "Blocked",
  "needs-review": "Needs review",
};

const STATUS_STYLES: Record<DeckCoordinationSummary["status"], string> = {
  idle: "bg-surface-2 text-muted-foreground",
  active: "bg-running/15 text-running",
  blocked: "bg-destructive/15 text-destructive",
  "needs-review": "bg-stale/15 text-stale",
};

const actionButtonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-50";

const primaryButtonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50";

const SectionTitle = ({ children }: { children: string }) => (
  <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
    {children}
  </h3>
);

type AgentSheetProps = {
  orchestration: DeckCoordinationSummary | null;
  visuals: MascotVisuals | null;
  onClose: () => void;
  onTodoToggle?: ((coordinationId: string, itemIndex: number, done: boolean) => void) | undefined;
  onVaultFileClick: (coordinationId: string, fileName: string) => void;
  onCreateAgent?: ((coordinationId: string) => Promise<string | undefined>) | undefined;
  onSpawnSwarm?:
    | ((coordinationId: string, workspaceMode: CoordinationWorkspaceMode) => Promise<void>)
    | undefined;
};

export const AgentSheet = ({
  orchestration,
  visuals,
  onClose,
  onTodoToggle,
  onVaultFileClick,
  onCreateAgent,
  onSpawnSwarm,
}: AgentSheetProps) => {
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const run = async (key: string, task: () => Promise<string | void>) => {
    setBusyAction(key);
    setMessage(null);

    try {
      const successText = await task();

      setMessage({ tone: "ok", text: successText || "Done." });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Action failed.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const progressPct =
    orchestration && orchestration.todoTotal > 0
      ? Math.round((orchestration.todoDone / orchestration.todoTotal) * 100)
      : 0;

  return (
    <Sheet
      onOpenChange={(open) => {
        if (!open) {
          setMessage(null);
          onClose();
        }
      }}
      open={orchestration !== null}
    >
      <SheetContent aria-label={orchestration ? `${orchestration.displayName} agent` : "Agent"}>
        {orchestration ? (
          <>
            <SheetHeader>
              <div className="flex items-center gap-4">
                {visuals ? (
                  <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-surface-2">
                    <MascotSprite
                      animation={visuals.animation}
                      accessory={visuals.accessory}
                      color={visuals.color}
                      expression={visuals.expression}
                      identitySeed={visuals.identitySeed}
                      size={56}
                      speedMs={100}
                      variant={visuals.variant}
                      {...(visuals.hairColor ? { hairColor: visuals.hairColor } : {})}
                    />
                  </div>
                ) : null}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <SheetTitle>{orchestration.displayName}</SheetTitle>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        STATUS_STYLES[orchestration.status],
                      )}
                    >
                      {STATUS_LABELS[orchestration.status]}
                    </span>
                    {orchestration.agentProvider ? (
                      <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        {orchestration.agentProvider}
                      </span>
                    ) : null}
                  </div>
                  <SheetDescription className="mt-1">
                    {orchestration.description || "No description yet."}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <SheetBody>
              <section className="flex flex-col gap-3">
                <SectionTitle>Actions</SectionTitle>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={primaryButtonClass}
                    disabled={busyAction !== null || !onCreateAgent}
                    onClick={() => {
                      void run("agent", async () => {
                        await onCreateAgent?.(orchestration.coordinationId);

                        return "Agent started. Find it on the Agents tab.";
                      });
                    }}
                    type="button"
                  >
                    {busyAction === "agent" ? "Starting…" : "Create agent"}
                  </button>
                  <button
                    className={actionButtonClass}
                    disabled={busyAction !== null || !onSpawnSwarm}
                    onClick={() => {
                      void run("worktree", async () => {
                        await onSpawnSwarm?.(orchestration.coordinationId, "worktree");

                        return "Swarm started in separate worktrees.";
                      });
                    }}
                    type="button"
                  >
                    {busyAction === "worktree" ? "Spawning…" : "Spawn swarm (worktrees)"}
                  </button>
                  <button
                    className={actionButtonClass}
                    disabled={busyAction !== null || !onSpawnSwarm}
                    onClick={() => {
                      void run("shared", async () => {
                        await onSpawnSwarm?.(orchestration.coordinationId, "shared");

                        return "Swarm started in the shared workspace.";
                      });
                    }}
                    type="button"
                  >
                    {busyAction === "shared" ? "Spawning…" : "Spawn swarm (shared)"}
                  </button>
                </div>
                {message ? (
                  <output
                    className={cn(
                      "text-sm",
                      message.tone === "error" ? "text-destructive" : "text-running",
                    )}
                  >
                    {message.text}
                  </output>
                ) : null}
              </section>

              <section className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between">
                  <SectionTitle>Todos</SectionTitle>
                  {orchestration.todoTotal > 0 ? (
                    <span className="text-xs font-medium text-muted-foreground tabular-nums">
                      {orchestration.todoDone}/{orchestration.todoTotal}
                    </span>
                  ) : null}
                </div>
                {orchestration.todoTotal > 0 ? (
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                ) : null}
                {orchestration.todoItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No todos yet.</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {orchestration.todoItems.map((item, index) => (
                      <li key={item.text}>
                        <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-surface-2">
                          <input
                            checked={item.done}
                            className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]"
                            onChange={() => {
                              onTodoToggle?.(orchestration.coordinationId, index, !item.done);
                            }}
                            type="checkbox"
                          />
                          <span
                            className={cn(
                              "leading-snug",
                              item.done && "text-muted-foreground line-through",
                            )}
                          >
                            {item.text}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {orchestration.vaultFiles.length > 0 ? (
                <section className="flex flex-col gap-3">
                  <SectionTitle>Vault files</SectionTitle>
                  <div className="flex flex-wrap gap-2">
                    {orchestration.vaultFiles.map((file) => (
                      <button
                        className={actionButtonClass}
                        key={file}
                        onClick={() => {
                          onClose();
                          onVaultFileClick(orchestration.coordinationId, file);
                        }}
                        type="button"
                      >
                        {file}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
            </SheetBody>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
};
