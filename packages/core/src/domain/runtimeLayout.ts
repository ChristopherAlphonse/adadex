/** Workspace-local runtime directory (replaces legacy `.octogent`). */
export const WORKSPACE_RUNTIME_DIR = ".adadex";
/** Previous workspace runtime directory; migrated on startup when `.adadex` is absent. */
export const LEGACY_WORKSPACE_RUNTIME_DIR = ".octogent";

/** Agent-facing markdown roots under the workspace runtime dir. */
export const COORDINATIONS_DIR_SEGMENT = "coordinations";
export const LEGACY_COORDINATIONS_DIR_SEGMENT = "tentacles";

/** Terminal registry filename under `state/`. */
export const TERMINAL_REGISTRY_FILENAME = "coordinations.json";
export const LEGACY_TERMINAL_REGISTRY_FILENAME = "tentacles.json";

/** Per-user global config directory name (under home). */
export const GLOBAL_RUNTIME_DIR_NAME = ".adadex";
export const LEGACY_GLOBAL_RUNTIME_DIR_NAME = ".octogent";
