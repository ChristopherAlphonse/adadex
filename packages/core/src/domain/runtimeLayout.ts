import { LEGACY_DECK_REGISTRY_LIST_KEY } from "./legacyProductKeys";

/** Workspace-local runtime directory. */
export const WORKSPACE_RUNTIME_DIR = ".adadex";

/** Agent-facing markdown roots under the workspace runtime dir. */
export const COORDINATIONS_DIR_SEGMENT = "coordinations";
/** Legacy workspace folder segment (older installs); value equals former product folder name. */
export const LEGACY_COORDINATIONS_DIR_SEGMENT = LEGACY_DECK_REGISTRY_LIST_KEY;

/** Terminal registry filename under `state/`. */
export const TERMINAL_REGISTRY_FILENAME = "coordinations.json";
/** Legacy registry filename on disk (older installs). */
export const LEGACY_TERMINAL_REGISTRY_FILENAME = `${LEGACY_DECK_REGISTRY_LIST_KEY}.json`;

/** Per-user global config directory name (under home). */
export const GLOBAL_RUNTIME_DIR_NAME = ".adadex";
