export const TERMINAL_ID_PREFIX = "terminal-";
export const TERMINAL_REGISTRY_VERSION = 3;
export const TERMINAL_REGISTRY_RELATIVE_PATH = ".adadex/state/coordinations.json";
export const TERMINAL_TRANSCRIPT_RELATIVE_PATH = ".adadex/state/transcripts";
export const COORDINATION_WORKTREE_RELATIVE_PATH = ".adadex/worktrees";
/** New worktree branches use this prefix; existing repos may still use legacy `octogent/`. */
export const COORDINATION_WORKTREE_BRANCH_PREFIX = "adadex/";
export const LEGACY_COORDINATION_WORKTREE_BRANCH_PREFIX = "octogent/";
export const DEFAULT_AGENT_PROVIDER = "codex" as const;

export const TERMINAL_BOOTSTRAP_COMMANDS: Record<string, string> = {
  codex: "codex",
};
export const TERMINAL_SESSION_IDLE_GRACE_MS = 5 * 60 * 1000;
export const TERMINAL_SCROLLBACK_MAX_BYTES = 512 * 1024;
export const TERMINAL_MAX_CONCURRENT_SESSIONS = 32;
export const DEFAULT_TERMINAL_INACTIVITY_THRESHOLD_MS = 2 * 24 * 60 * 60 * 1000; // 2 days
