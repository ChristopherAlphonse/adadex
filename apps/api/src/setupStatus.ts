import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import {
  COORDINATIONS_DIR_SEGMENT,
  WORKSPACE_RUNTIME_DIR,
  type WorkspaceSetupSnapshot,
  type WorkspaceSetupStep,
} from "@adadex/core";

import { readDeckCoordinations } from "./deck/readDeckCoordinations";
import {
  deriveProjectIdFromWorkspace,
  ensureAdadexGitignoreEntry,
  ensureProjectScaffold,
  hasAdadexGitignoreEntry,
  loadProjectConfig,
  migrateStateToGlobal,
  registerProject,
} from "./projectPersistence";
import { readSetupState } from "./setupState";
import { collectStartupPrerequisiteReport } from "./startupPrerequisites";

export const initializeWorkspaceFiles = (workspaceCwd: string, projectStateDir: string) => {
  const projectName = loadProjectConfig(workspaceCwd)?.displayName;
  const projectConfig = ensureProjectScaffold(
    workspaceCwd,
    projectName,
    deriveProjectIdFromWorkspace(workspaceCwd),
  );
  registerProject(workspaceCwd, projectConfig.displayName);
  mkdirSync(join(projectStateDir, "state"), { recursive: true });
  migrateStateToGlobal(workspaceCwd, projectStateDir);

  return { projectConfig, projectStateDir };
};

export const ensureWorkspaceGitignore = (workspaceCwd: string) =>
  ensureAdadexGitignoreEntry(workspaceCwd);

export const readWorkspaceSetupSnapshot = (
  workspaceCwd: string,
  projectStateDir: string,
): WorkspaceSetupSnapshot => {
  const prerequisites = collectStartupPrerequisiteReport();
  const projectConfig = loadProjectConfig(workspaceCwd);
  const runtimeDir = join(workspaceCwd, WORKSPACE_RUNTIME_DIR);
  const hasProjectScaffold =
    projectConfig !== null &&
    existsSync(join(runtimeDir, COORDINATIONS_DIR_SEGMENT)) &&
    existsSync(join(runtimeDir, "worktrees")) &&
    existsSync(join(projectStateDir, "state"));
  const hasGitignore = hasAdadexGitignoreEntry(workspaceCwd);
  const coordinations = readDeckCoordinations(workspaceCwd, projectStateDir);
  const coordinationCount = coordinations.length;
  const hasAnyCoordinations = coordinationCount > 0;
  const setupState = readSetupState(projectStateDir);
  const isFirstRun = !hasAnyCoordinations && !setupState.coordinationsInitializedAt;
  const verifiedSteps = setupState.verifiedSteps ?? {};
  const isCodexVerified = Boolean(verifiedSteps["check-codex"]);
  const isGitVerified = Boolean(verifiedSteps["check-git"]);
  const isCurlVerified = Boolean(verifiedSteps["check-curl"]);
  const hasCodex = prerequisites.availability.codex;
  const hasGit = prerequisites.availability.git;
  const hasCurl = prerequisites.availability.curl;

  const steps: WorkspaceSetupStep[] = [
    {
      id: "initialize-workspace",
      title: "Initialize workspace",
      description: "Create Adadex project files and runtime directories.",
      complete: hasProjectScaffold,
      required: true,
      actionLabel: "Initialize workspace",
      statusText: hasProjectScaffold
        ? "Workspace files are ready."
        : "Create .adadex project files before continuing.",
      guidance: hasProjectScaffold
        ? null
        : "Workspace initialization failed. Run the Adadex initializer in this repository.",
      command: hasProjectScaffold ? null : "adadex init",
    },
    {
      id: "ensure-gitignore",
      title: "Ignore local planning files",
      description: "Add .adadex/ and .planning/ to .gitignore, or create .gitignore when it is missing.",
      complete: hasGitignore,
      required: true,
      actionLabel: "Update .gitignore",
      statusText: hasGitignore
        ? ".gitignore covers .adadex/ and .planning/."
        : "Add .adadex/ and .planning/ to .gitignore before creating coordinations.",
      guidance: hasGitignore
        ? null
        : "Git ignore entries are missing. Create or update .gitignore with the Adadex workspace and planning paths.",
      command: hasGitignore ? null : "printf '.adadex/\\n.planning/\\n' >> .gitignore",
    },
    {
      id: "check-codex",
      title: "Check Codex",
      description: "Verify the Codex CLI workflow is available on this machine.",
      complete: hasCodex && isCodexVerified,
      required: false,
      actionLabel: "Check Codex",
      statusText: hasCodex
        ? isCodexVerified
          ? "Codex is available."
          : "Confirm Codex before using the planner."
        : "Codex is unavailable.",
      guidance: hasCodex
        ? isCodexVerified
          ? null
          : "Click to verify the Codex workflow on this machine."
        : "Install Codex CLI and log in before launching agent terminals.",
      command: hasCodex ? null : "codex login",
    },
    {
      id: "check-git",
      title: "Check Git",
      description: "Verify Git is available for worktree-backed coordinations.",
      complete: hasGit && isGitVerified,
      required: false,
      actionLabel: "Check Git",
      statusText: hasGit
        ? isGitVerified
          ? "Git is available."
          : "Confirm Git before launching worktree-backed coordinations."
        : "Git is unavailable.",
      guidance: hasGit
        ? isGitVerified
          ? null
          : "Click to verify Git support for worktree terminal flows."
        : "Install Git to enable worktree terminals and branch flows.",
      command: hasGit ? null : "git --version",
    },
    {
      id: "check-curl",
      title: "Check curl",
      description: "Verify curl is available for agent hook callbacks.",
      complete: hasCurl && isCurlVerified,
      required: false,
      actionLabel: "Check curl",
      statusText: hasCurl
        ? isCurlVerified
          ? "curl is available."
          : "Confirm curl before using agent hook callbacks."
        : "curl is unavailable.",
      guidance: hasCurl
        ? isCurlVerified
          ? null
          : "Click to verify hook callback support on this machine."
        : "Install curl to restore agent hook callbacks.",
      command: hasCurl ? null : "curl --version",
    },
    {
      id: "create-coordinations",
      title: "Create coordinations",
      description: "Create at least one coordination before launching a coding agent.",
      complete: hasAnyCoordinations,
      required: true,
      actionLabel: null,
      statusText: hasAnyCoordinations
        ? `${coordinationCount} coordination${coordinationCount === 1 ? "" : "s"} ready.`
        : "Create your first coordination to continue.",
      guidance: hasAnyCoordinations
        ? null
        : "Use the planner or manual creation to add at least one coordination.",
      command: null,
    },
  ];

  return {
    isFirstRun,
    shouldShowSetupCard:
      isFirstRun || (!hasAnyCoordinations && (!hasProjectScaffold || !hasGitignore)),
    hasAnyCoordinations,
    coordinationCount,
    steps,
  };
};
