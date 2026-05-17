import type { TerminalSnapshot } from "@adadex/core";

import type { GraphNode } from "../../app/canvas/types";
import type { CodexUsageSnapshot, CoordinationGitStatusSnapshot } from "../../app/types";
import { KV, Section } from "./ConsolePrimitives";
import { StatusPill } from "./StatusPill";
import { mapAgentStateToStatus } from "./mapAgentStatus";

type ConsoleInspectorPanelProps = {
  selectedNode: GraphNode | null;
  terminal: TerminalSnapshot | null;
  gitStatus: CoordinationGitStatusSnapshot | null;
  codexUsage: CodexUsageSnapshot | null;
};

const resolveTerminalId = (node: GraphNode): string =>
  node.id.startsWith("t:") ? node.id.slice(2) : node.id;

const formatUptime = (startedAt: string | undefined): string => {
  if (!startedAt) return "—";
  const elapsedMs = Date.now() - new Date(startedAt).getTime();
  if (Number.isNaN(elapsedMs) || elapsedMs < 0) return "—";
  const totalMinutes = Math.floor(elapsedMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
};

const formatUsagePercent = (usage: CodexUsageSnapshot | null): number | null => {
  if (!usage || usage.status !== "ok") return null;
  const value = Number(usage.primaryUsedPercent ?? 0);
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
};

export const ConsoleInspectorPanel = ({
  selectedNode,
  terminal,
  gitStatus,
  codexUsage,
}: ConsoleInspectorPanelProps): React.ReactElement => {
  const status = mapAgentStateToStatus(terminal?.state ?? selectedNode?.agentState);
  const title = terminal?.label ?? selectedNode?.label ?? "No selection";
  const id = selectedNode ? resolveTerminalId(selectedNode) : "—";
  const usagePercent = formatUsagePercent(codexUsage);
  const branchLabel = gitStatus?.branchName ?? "—";
  const worktreeLabel =
    gitStatus?.worktreePath ??
    (terminal?.workspaceMode === "shared" || selectedNode?.workspaceMode !== "worktree"
      ? "shared workspace"
      : "—");
  const commitLabel = gitStatus?.headCommit ?? "—";
  const changedFiles = gitStatus?.changedFiles ?? [];

  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-l border-border bg-surface/40">
      <div className="border-b border-border p-5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Inspector
          </p>
          <span className="font-mono text-[11px] text-muted-foreground">{id}</span>
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <h2 className="text-[16px] font-semibold tracking-tight text-foreground">{title}</h2>
          {selectedNode ? <StatusPill status={status} /> : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {selectedNode ? (
          <>
            <Section title="Metadata">
              <div className="space-y-1">
                <KV label="Branch" value={branchLabel} mono />
                <KV label="Worktree" value={worktreeLabel} mono />
                <KV label="Commit" value={commitLabel} mono />
                <KV label="Uptime" value={formatUptime(terminal?.startedAt)} mono />
              </div>
            </Section>

            <Section title="Resources">
              <div>
                <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
                  <span className="text-muted-foreground">Tokens</span>
                  <span className="font-mono text-foreground">
                    {usagePercent === null ? "Unavailable" : `${usagePercent}% used`}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full bg-brand transition-all"
                    style={{ width: `${usagePercent ?? 0}%` }}
                  />
                </div>
              </div>
            </Section>

            {terminal?.lifecycleReason ? (
              <Section title="Runtime">
                <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                  {terminal.lifecycleReason}
                </p>
              </Section>
            ) : null}

            <Section title="Diff Summary">
              <div className="space-y-2 rounded-md border border-border bg-background/60 p-3 font-mono text-[12px] leading-relaxed">
                {gitStatus ? (
                  changedFiles.length > 0 ? (
                    changedFiles.slice(0, 4).map((file) => (
                      <div key={file} className="flex items-center justify-between gap-3">
                        <span className="truncate font-semibold text-foreground">{file}</span>
                        <span className="text-muted-foreground">changed</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-muted-foreground">No local changes</div>
                  )
                ) : (
                  <div className="text-muted-foreground">No worktree diff data</div>
                )}
                <div className="border-t border-border pt-2 text-[11px] text-muted-foreground">
                  {gitStatus ? (
                    <>
                      {changedFiles.length} files changed ·{" "}
                      <span className="text-running">+{gitStatus.insertedLineCount}</span>{" "}
                      <span className="text-stopped">-{gitStatus.deletedLineCount}</span>
                    </>
                  ) : (
                    "Open a worktree agent for git diff details"
                  )}
                  {changedFiles.length > 4 ? (
                    <span> · {changedFiles.length - 4} more</span>
                  ) : null}
                  </div>
              </div>
            </Section>
          </>
        ) : (
          <div className="p-5 text-[13px] text-muted-foreground">
            Select an agent on the canvas to inspect session metadata.
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!selectedNode}
            className="flex h-9 items-center justify-center rounded-md border border-border bg-white/5 text-[13px] font-medium text-foreground transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Attach
          </button>
          <button
            type="button"
            disabled={!selectedNode}
            className="flex h-9 items-center justify-center rounded-md bg-foreground text-[13px] font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Deploy
          </button>
        </div>
      </div>
    </aside>
  );
};
