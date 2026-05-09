import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  COORDINATION_WORKTREE_BRANCH_PREFIX,
  COORDINATION_WORKTREE_RELATIVE_PATH,
} from "./constants";
import { toErrorMessage } from "./systemClients";
import type { GitClient, PersistedTerminal } from "./types";
import { RuntimeInputError } from "./types";

type CreateWorktreeManagerOptions = {
  workspaceCwd: string;
  gitClient: GitClient;
  terminals: Map<string, PersistedTerminal>;
};

type RemoveOrchestrationWorktreeOptions = {
  bestEffort?: boolean;
};

/** Resolve the effective worktree identifier for a terminal. */
const getEffectiveWorktreeId = (terminal: PersistedTerminal): string =>
  terminal.worktreeId ?? terminal.coordinationId;

/** Find any terminal whose effective worktree identifier matches. */
const findTerminalForWorktree = (
  terminals: Map<string, PersistedTerminal>,
  worktreeIdentifier: string,
): PersistedTerminal | undefined => {
  for (const terminal of terminals.values()) {
    if (getEffectiveWorktreeId(terminal) === worktreeIdentifier) {
      return terminal;
    }
  }
  return undefined;
};

export const createWorktreeManager = ({
  workspaceCwd,
  gitClient,
  terminals,
}: CreateWorktreeManagerOptions) => {
  const getOrchestrationWorktreePath = (coordinationId: string) =>
    join(workspaceCwd, COORDINATION_WORKTREE_RELATIVE_PATH, coordinationId);
  const getOrchestrationBranchName = (coordinationId: string) =>
    `${COORDINATION_WORKTREE_BRANCH_PREFIX}${coordinationId}`;

  const getOrchestrationWorkspaceCwd = (worktreeIdentifier: string) => {
    const terminal = findTerminalForWorktree(terminals, worktreeIdentifier);
    if (!terminal) {
      throw new Error(`No terminal found for worktree: ${worktreeIdentifier}`);
    }

    if (terminal.workspaceMode === "worktree") {
      return getOrchestrationWorktreePath(worktreeIdentifier);
    }

    return workspaceCwd;
  };

  const assertWorktreeCreationSupported = () => {
    gitClient.assertAvailable();
    if (!gitClient.isRepository(workspaceCwd)) {
      throw new RuntimeInputError(
        "Worktree terminals require a git repository at the workspace root.",
      );
    }
  };

  const createOrchestrationWorktree = (coordinationId: string, baseRef = "HEAD") => {
    assertWorktreeCreationSupported();
    const worktreePath = getOrchestrationWorktreePath(coordinationId);
    if (existsSync(worktreePath)) {
      throw new RuntimeInputError(`Worktree path already exists: ${worktreePath}`);
    }

    try {
      gitClient.addWorktree({
        cwd: workspaceCwd,
        path: worktreePath,
        branchName: `${COORDINATION_WORKTREE_BRANCH_PREFIX}${coordinationId}`,
        baseRef,
      });
    } catch (error) {
      throw new Error(`Unable to create worktree for ${coordinationId}: ${toErrorMessage(error)}`);
    }
  };

  const hasOrchestrationWorktree = (coordinationId: string): boolean =>
    existsSync(getOrchestrationWorktreePath(coordinationId));

  const removeOrchestrationWorktree = (
    coordinationId: string,
    options: RemoveOrchestrationWorktreeOptions = {},
  ) => {
    const { bestEffort = false } = options;
    const worktreePath = getOrchestrationWorktreePath(coordinationId);
    const branchName = getOrchestrationBranchName(coordinationId);

    if (existsSync(worktreePath)) {
      try {
        gitClient.removeWorktree({
          cwd: workspaceCwd,
          path: worktreePath,
        });
      } catch (error) {
        if (bestEffort) {
          return;
        }
        throw new RuntimeInputError(
          `Unable to remove worktree for ${coordinationId}: ${toErrorMessage(error)}`,
        );
      }
    }

    try {
      gitClient.removeBranch({
        cwd: workspaceCwd,
        branchName,
      });
    } catch (error) {
      if (bestEffort) {
        return;
      }
      throw new RuntimeInputError(
        `Unable to remove branch for ${coordinationId}: ${toErrorMessage(error)}`,
      );
    }
  };

  return {
    getOrchestrationWorkspaceCwd,
    createOrchestrationWorktree,
    hasOrchestrationWorktree,
    removeOrchestrationWorktree,
  };
};
