import type { CoordinationWorkspaceMode } from "@adadex/core";

import { COORDINATION_WORKTREE_BRANCH_PREFIX } from "../terminalRuntime/constants";

export type SwarmWorker = {
  terminalId: string;
  todoIndex: number;
  todoText: string;
};

export const buildWorkerContextIntro = (workspaceMode: CoordinationWorkspaceMode): string =>
  workspaceMode === "worktree"
    ? "You are working on an isolated worktree branch, not the main branch."
    : "You are working in the shared main workspace on the main branch, not in an isolated worktree.";

export const buildWorkerGuidelines = (
  workspaceMode: CoordinationWorkspaceMode,
  terminalId: string,
): string =>
  workspaceMode === "worktree"
    ? `- You are working in an isolated git worktree on branch \`${COORDINATION_WORKTREE_BRANCH_PREFIX}${terminalId}\`. Make changes freely without worrying about conflicts with other agents.`
    : [
        "- You are working in the shared main workspace. Other workers may touch the same files, so keep your edits narrow, avoid broad refactors, and coordinate via your parent if you hit overlap.",
        "- Do NOT create commits in shared mode. Leave your changes uncommitted for the coordinator to review and commit later.",
        "- Do NOT mark todo items done or rewrite coordination context files unless your assigned todo item explicitly requires it. The coordinator handles the final coordination-level sync.",
      ].join("\n");

export const buildWorkerCommitGuidance = (workspaceMode: CoordinationWorkspaceMode): string =>
  workspaceMode === "worktree"
    ? "- Commit your changes with a clear commit message describing what you did."
    : "- Do NOT commit in shared mode. Leave your completed changes uncommitted and report DONE with a short summary of what changed.";

export const buildWorkerDefinitionOfDoneCommitStep = (
  workspaceMode: CoordinationWorkspaceMode,
): string =>
  workspaceMode === "worktree"
    ? "Changes are committed with a descriptive message."
    : "Changes are left uncommitted in the shared workspace, ready for coordinator review.";

export const buildWorkerReminder = (workspaceMode: CoordinationWorkspaceMode): string =>
  workspaceMode === "worktree" ? "Commit." : "Do not commit in shared mode.";

export const buildWorkerWorkspaceSection = (
  workspaceMode: CoordinationWorkspaceMode,
  workers: SwarmWorker[],
): string =>
  workspaceMode === "worktree"
    ? [
        "Each worker commits to its own isolated branch:",
        "",
        ...workers.map(
          (w) =>
            `- \`${COORDINATION_WORKTREE_BRANCH_PREFIX}${w.terminalId}\` — item #${w.todoIndex}: ${w.todoText}`,
        ),
      ].join("\n")
    : [
        "Workers are running in the shared main workspace, not in separate worktrees.",
        "",
        "There are no per-worker branches for this swarm. Supervise them carefully to avoid overlapping edits in the same files.",
      ].join("\n");

const buildWorktreeCompletionStrategySection = (
  baseBranch: string,
  coordinationId: string,
  workerCount: number,
): string =>
  [
    `Only begin merging after ALL ${workerCount} workers have reported DONE.`,
    "",
    "### Step-by-step merge process",
    "",
    `1. **Create an integration branch** from \`${baseBranch}\`. First check if a stale integration branch exists from a previous swarm attempt — if so, delete it before proceeding:`,
    "   ```bash",
    `   git branch -D adadex_integration_${coordinationId} 2>/dev/null || true`,
    `   git checkout ${baseBranch}`,
    `   git checkout -b adadex_integration_${coordinationId}`,
    "   ```",
    "",
    "2. **Merge each worker branch** into the integration branch one at a time. Start with the branch most likely to merge cleanly (fewest changes):",
    "   ```bash",
    "   git merge <worker-branch-name> --no-edit",
    "   ```",
    "   If there are conflicts, resolve them carefully. Read the conflicting files and understand both sides before choosing.",
    "",
    "3. **Run tests** on the integration branch after all merges. Do not skip this step.",
    "",
    "4. **If tests pass**, merge the integration branch into the base branch:",
    "   ```bash",
    `   git checkout ${baseBranch}`,
    `   git merge adadex_integration_${coordinationId} --no-edit`,
    "   ```",
    "",
    "5. **If tests fail**, investigate and fix before merging. Do not merge broken code.",
    "",
    `6. **Update coordination state/docs** before finalizing. Mark completed items as done in \`.adadex/coordinations/${coordinationId}/todo.md\`, and update \`.adadex/coordinations/${coordinationId}/CONTEXT.md\` or other coordination markdown files if the merged work changed the reality they describe.`,
    "",
    "7. **Clean up** the integration branch:",
    "   ```bash",
    `   git branch -d adadex_integration_${coordinationId}`,
    "   ```",
    "",
    "### Merge failure recovery",
    "",
    "If a worker's branch has conflicts that are too complex to resolve, send a message to that worker asking them to rebase their work. Merge the other workers' branches first.",
  ].join("\n");

const buildSharedCompletionStrategySection = (
  baseBranch: string,
  coordinationId: string,
  workerCount: number,
): string =>
  [
    `Only begin final verification after ALL ${workerCount} workers have reported DONE.`,
    "",
    "Workers are sharing the main workspace, so there are no per-worker branches to merge.",
    "",
    "### Step-by-step completion process",
    "",
    `1. **Verify the workspace is on \`${baseBranch}\`** and review the overall diff carefully. Do not assume the combined result is safe just because workers reported DONE.`,
    "",
    "2. **Review the changed files** to ensure workers did not overwrite each other or leave partial edits.",
    "",
    "3. **Run tests** on the shared workspace after all workers report DONE. Do not skip this step.",
    "",
    "4. **If tests fail**, investigate and coordinate fixes. Do not declare the swarm complete while the workspace is broken.",
    "",
    `5. **Update coordination state/docs** before asking for approval. Mark completed items as done in \`.adadex/coordinations/${coordinationId}/todo.md\`, and update \`.adadex/coordinations/${coordinationId}/CONTEXT.md\` or other coordination markdown files if the completed work changed the reality they describe. If no coordination docs need updates, say that explicitly.`,
    "",
    "6. **Wait for explicit user approval** before creating any commit on the shared main branch. Present a concise summary of the reviewed diff, test results, and coordination-doc updates first.",
    "",
    "7. **Only after approval, create one final commit** on the shared branch that captures the swarm's completed work.",
    "",
    "8. **Report completion** only after the shared workspace is reviewed, tests pass, coordination docs are synced, approval is granted, and the final commit is created.",
    "",
    "### Shared-workspace failure recovery",
    "",
    "If two workers collide in the same files, stop them from making broad new edits, inspect the current diff, and coordinate targeted follow-up changes instead of pretending there is a clean merge boundary.",
  ].join("\n");

export const buildCompletionStrategySection = (
  workspaceMode: CoordinationWorkspaceMode,
  baseBranch: string,
  coordinationId: string,
  workerCount: number,
): string =>
  workspaceMode === "worktree"
    ? buildWorktreeCompletionStrategySection(baseBranch, coordinationId, workerCount)
    : buildSharedCompletionStrategySection(baseBranch, coordinationId, workerCount);
