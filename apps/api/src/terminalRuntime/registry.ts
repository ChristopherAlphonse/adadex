import { existsSync, readFileSync } from "node:fs";

import {
  LEGACY_PERSISTED_COORDINATION_ID_ALT_KEY,
  LEGACY_PERSISTED_COORDINATION_NAME_ALT_KEY,
  LEGACY_REGISTRY_V2_COORDINATION_LIST_KEY,
  LEGACY_UI_CANVAS_OPEN_COORDINATION_IDS_KEY,
, isBoolean, isNumber, isObjectValue, isString} from "@adadex/core";

import { writeTextFileAtomic, writeTextFileAtomicAsync } from "../atomicJsonFile";
import { TERMINAL_REGISTRY_VERSION } from "./constants";
import { toErrorMessage } from "./systemClients";
import type {
  CoordinationWorkspaceMode,
  PersistedTerminal,
  PersistedUiState,
  TerminalLifecycleState,
  TerminalNameOrigin,
  TerminalRegistryDocument,
} from "./types";
import { isTerminalAgentProvider, isTerminalCompletionSoundId } from "./types";

const REGISTRY_PERSIST_DEBOUNCE_MS = 100;

type TerminalRegistryState = {
  terminals: Map<string, PersistedTerminal>;
  uiState: PersistedUiState;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && isObjectValue(value) && !Array.isArray(value);

const isTerminalNameOrigin = (value: unknown): value is TerminalNameOrigin =>
  value === "generated" || value === "user" || value === "prompt";

const isTerminalLifecycleState = (value: unknown): value is TerminalLifecycleState =>
  value === "registered" ||
  value === "running" ||
  value === "stopped" ||
  value === "exited" ||
  value === "stale";

const inferTerminalNameOrigin = (
  terminalId: string,
  coordinationName: string,
): TerminalNameOrigin => {
  if (coordinationName === terminalId || /^Adadex Terminal \d+$/.test(coordinationName)) {
    return "generated";
  }

  return "user";
};

const parsePersistedUiState = (value: unknown): PersistedUiState => {
  if (!isRecord(value)) {
    return {};
  }

  const nextState: PersistedUiState = {};

  if (isBoolean(value.isAgentsSidebarVisible)) {
    nextState.isAgentsSidebarVisible = value.isAgentsSidebarVisible;
  }

  if (isNumber(value.sidebarWidth) && Number.isFinite(value.sidebarWidth)) {
    nextState.sidebarWidth = value.sidebarWidth;
  }

  if (isBoolean(value.isActiveAgentsSectionExpanded)) {
    nextState.isActiveAgentsSectionExpanded = value.isActiveAgentsSectionExpanded;
  }

  if (isBoolean(value.isRuntimeStatusStripVisible)) {
    nextState.isRuntimeStatusStripVisible = value.isRuntimeStatusStripVisible;
  }

  const completionSoundValue = value.terminalCompletionSound;

  if (isTerminalCompletionSoundId(completionSoundValue)) {
    nextState.terminalCompletionSound = completionSoundValue;
  }

  const minimizedIds = value.minimizedTerminalIds;

  if (Array.isArray(minimizedIds)) {
    const ids = minimizedIds.filter((id): id is string => isString(id));
    nextState.minimizedTerminalIds = [...new Set(ids)];
  }

  const widths = value.terminalWidths;

  if (isRecord(widths)) {
    const terminalWidths = Object.entries(widths).reduce<Record<string, number>>(
      (acc, [id, width]) => {
        if (isNumber(width) && Number.isFinite(width)) {
          acc[id] = width;
        }

        return acc;
      },
      {},
    );

    nextState.terminalWidths = terminalWidths;
  }

  if (Array.isArray(value.canvasOpenTerminalIds)) {
    nextState.canvasOpenTerminalIds = value.canvasOpenTerminalIds.filter(
      (id): id is string => isString(id),
    );
  }

  if (Array.isArray(value.canvasOpenCoordinationIds)) {
    nextState.canvasOpenCoordinationIds = value.canvasOpenCoordinationIds.filter(
      (id): id is string => isString(id),
    );
  } else {
    const legacyCanvasOpen = value[LEGACY_UI_CANVAS_OPEN_COORDINATION_IDS_KEY];

    if (Array.isArray(legacyCanvasOpen)) {
      nextState.canvasOpenCoordinationIds = legacyCanvasOpen.filter(
        (id): id is string => isString(id),
      );
    }
  }

  if (
    isNumber(value.canvasTerminalsPanelWidth) &&
    Number.isFinite(value.canvasTerminalsPanelWidth)
  ) {
    nextState.canvasTerminalsPanelWidth = value.canvasTerminalsPanelWidth;
  }

  return nextState;
};

export const pruneUiStateTerminalReferences = (
  uiState: PersistedUiState,
  terminals: Map<string, PersistedTerminal>,
): PersistedUiState => {
  const activeTerminalIds = new Set(terminals.keys());

  const nextState: PersistedUiState = {
    ...uiState,
  };

  if (nextState.minimizedTerminalIds) {
    nextState.minimizedTerminalIds = nextState.minimizedTerminalIds.filter((id) =>
      activeTerminalIds.has(id),
    );
  }

  if (nextState.terminalWidths) {
    nextState.terminalWidths = Object.entries(nextState.terminalWidths).reduce<
      Record<string, number>
    >((acc, [id, width]) => {
      if (activeTerminalIds.has(id)) {
        acc[id] = width;
      }

      return acc;
    }, {});
  }

  return nextState;
};

/**
 * Migrate a v1/v2 registry document to v3 terminal format.
 * Each old coordination entry becomes a terminal where terminalId = coordinationId.
 * Child agents are dropped.
 */
const migrateV2ToV3 = (
  record: Record<string, unknown>,
  registryPath: string,
): Map<string, PersistedTerminal> => {
  const rawList = record[LEGACY_REGISTRY_V2_COORDINATION_LIST_KEY];

  if (!Array.isArray(rawList)) {
    throw new Error(`Invalid registry coordination list (${registryPath}).`);
  }

  const terminals = new Map<string, PersistedTerminal>();

  for (const item of rawList) {
    if (item === null || !isObjectValue(item)) {
      throw new Error(`Invalid registry coordination entry (${registryPath}).`);
    }

    const entry = item as Record<string, unknown>;
    const legacyCoordinationId = entry[LEGACY_PERSISTED_COORDINATION_ID_ALT_KEY];
    const legacyCoordinationName = entry[LEGACY_PERSISTED_COORDINATION_NAME_ALT_KEY];

    const coordinationIdRaw =
      isString(entry.coordinationId)
        ? entry.coordinationId
        : isString(legacyCoordinationId)
          ? legacyCoordinationId
          : null;

    const coordinationNameRaw =
      isString(entry.coordinationName)
        ? entry.coordinationName
        : isString(legacyCoordinationName)
          ? legacyCoordinationName
          : null;

    const coordinationId = coordinationIdRaw;
    const coordinationName = coordinationNameRaw;
    const createdAt = isString(entry.createdAt) ? entry.createdAt : null;

    if (!coordinationId || !coordinationName || !createdAt) {
      throw new Error(`Incomplete registry coordination entry (${registryPath}).`);
    }

    const rawWorkspaceMode = entry.workspaceMode;

    const workspaceMode: CoordinationWorkspaceMode =
      rawWorkspaceMode === "worktree" || rawWorkspaceMode === "shared"
        ? rawWorkspaceMode
        : "shared";

    if (terminals.has(coordinationId)) {
      throw new Error(`Duplicate coordination id in registry (${registryPath}): ${coordinationId}`);
    }

    terminals.set(coordinationId, {
      terminalId: coordinationId,
      coordinationId,
      coordinationName,
      nameOrigin: inferTerminalNameOrigin(coordinationId, coordinationName),
      createdAt,
      workspaceMode,
    });
  }

  return terminals;
};

const parseV3Terminals = (
  record: Record<string, unknown>,
  registryPath: string,
): Map<string, PersistedTerminal> => {
  const rawTerminals = record.terminals;

  if (!Array.isArray(rawTerminals)) {
    throw new Error(`Invalid registry terminals array (${registryPath}).`);
  }

  const terminals = new Map<string, PersistedTerminal>();

  for (const item of rawTerminals) {
    if (item === null || !isObjectValue(item)) {
      throw new Error(`Invalid terminal entry in registry (${registryPath}).`);
    }

    const entry = item as Record<string, unknown>;
    const terminalId = isString(entry.terminalId) ? entry.terminalId : null;
    const legacyCoordinationId = entry[LEGACY_PERSISTED_COORDINATION_ID_ALT_KEY];
    const legacyCoordinationName = entry[LEGACY_PERSISTED_COORDINATION_NAME_ALT_KEY];

    const coordinationId =
      isString(entry.coordinationId)
        ? entry.coordinationId
        : isString(legacyCoordinationId)
          ? legacyCoordinationId
          : null;

    const coordinationName =
      isString(entry.coordinationName)
        ? entry.coordinationName
        : isString(legacyCoordinationName)
          ? legacyCoordinationName
          : null;

    const createdAt = isString(entry.createdAt) ? entry.createdAt : null;

    if (!terminalId || !coordinationId || !coordinationName || !createdAt) {
      throw new Error(`Incomplete terminal entry in registry (${registryPath}).`);
    }

    const rawWorkspaceMode = entry.workspaceMode;

    const workspaceMode: CoordinationWorkspaceMode =
      rawWorkspaceMode === "worktree" || rawWorkspaceMode === "shared"
        ? rawWorkspaceMode
        : "shared";

    if (terminals.has(terminalId)) {
      throw new Error(`Duplicate terminal id in registry (${registryPath}): ${terminalId}`);
    }

    const terminal: PersistedTerminal = {
      terminalId,
      coordinationId,
      coordinationName,
      nameOrigin: isTerminalNameOrigin(entry.nameOrigin)
        ? entry.nameOrigin
        : inferTerminalNameOrigin(terminalId, coordinationName),
      createdAt,
      workspaceMode,
    };

    if (isString(entry.worktreeId)) terminal.worktreeId = entry.worktreeId;

    if (isString(entry.parentTerminalId))
      terminal.parentTerminalId = entry.parentTerminalId;

    if (isTerminalAgentProvider(entry.agentProvider)) terminal.agentProvider = entry.agentProvider;

    if (isString(entry.initialPrompt)) terminal.initialPrompt = entry.initialPrompt;

    if (isString(entry.initialInputDraft)) {
      terminal.initialInputDraft = entry.initialInputDraft;
    }

    if (isString(entry.autoRenamePromptContext)) {
      terminal.autoRenamePromptContext = entry.autoRenamePromptContext;
    }

    if (isString(entry.lastActiveAt)) terminal.lastActiveAt = entry.lastActiveAt;

    if (isTerminalLifecycleState(entry.lifecycleState)) {
      terminal.lifecycleState = entry.lifecycleState;
    }

    if (isString(entry.lifecycleReason)) {
      terminal.lifecycleReason = entry.lifecycleReason;
    }

    if (isString(entry.lifecycleUpdatedAt)) {
      terminal.lifecycleUpdatedAt = entry.lifecycleUpdatedAt;
    }

    if (
      isNumber(entry.processId) &&
      Number.isInteger(entry.processId) &&
      entry.processId > 0
    ) {
      terminal.processId = entry.processId;
    }

    if (isString(entry.startedAt)) terminal.startedAt = entry.startedAt;

    if (isString(entry.endedAt)) terminal.endedAt = entry.endedAt;

    if (isNumber(entry.exitCode) && Number.isFinite(entry.exitCode)) {
      terminal.exitCode = entry.exitCode;
    }

    if (
      (isNumber(entry.exitSignal) && Number.isFinite(entry.exitSignal)) ||
      isString(entry.exitSignal)
    ) {
      terminal.exitSignal = entry.exitSignal;
    }

    terminals.set(terminalId, terminal);
  }

  return terminals;
};

const parseRegistryDocument = (
  raw: string,
  registryPath: string,
): {
  terminals: Map<string, PersistedTerminal>;
  uiState: PersistedUiState;
} => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid terminal registry JSON (${registryPath}): ${toErrorMessage(error)}`);
  }

  if (parsed === null || !isObjectValue(parsed)) {
    throw new Error(`Invalid terminal registry shape (${registryPath}).`);
  }

  const record = parsed as Record<string, unknown>;
  const version = record.version;

  if (version !== 1 && version !== 2 && version !== TERMINAL_REGISTRY_VERSION) {
    throw new Error(`Unsupported terminal registry version in ${registryPath}: ${String(version)}`);
  }

  const terminals =
    version === 1 || version === 2
      ? migrateV2ToV3(record, registryPath)
      : parseV3Terminals(record, registryPath);

  return {
    terminals,
    uiState: pruneUiStateTerminalReferences(parsePersistedUiState(record.uiState), terminals),
  };
};

export const loadTerminalRegistry = (registryPath: string) => {
  if (!existsSync(registryPath)) {
    return {
      terminals: new Map<string, PersistedTerminal>(),
      uiState: {} as PersistedUiState,
    };
  }

  const raw = readFileSync(registryPath, "utf8");

  return parseRegistryDocument(raw, registryPath);
};

const serializeTerminalRegistry = (state: TerminalRegistryState) => {
  const document: TerminalRegistryDocument = {
    version: TERMINAL_REGISTRY_VERSION,
    terminals: [...state.terminals.values()],
    uiState: state.uiState,
  };

  return `${JSON.stringify(document, null, 2)}\n`;
};

const writeSerializedRegistrySync = (registryPath: string, serialized: string) => {
  writeTextFileAtomic(registryPath, serialized);
};

const writeSerializedRegistry = async (registryPath: string, serialized: string) => {
  await writeTextFileAtomicAsync(registryPath, serialized);
};

export const persistTerminalRegistry = (registryPath: string, state: TerminalRegistryState) => {
  writeSerializedRegistrySync(registryPath, serializeTerminalRegistry(state));
};

export const createTerminalRegistryPersistence = (registryPath: string) => {
  let pendingSerialized: string | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let writeLoopPromise: Promise<void> | null = null;
  let lastPersistedSerialized: string | null = null;

  const runWriteLoop = (): Promise<void> => {
    if (writeLoopPromise) {
      return writeLoopPromise;
    }

    if (pendingSerialized === null) {
      return Promise.resolve();
    }

    writeLoopPromise = (async () => {
      while (pendingSerialized !== null) {
        const serialized = pendingSerialized;
        pendingSerialized = null;

        try {
          await writeSerializedRegistry(registryPath, serialized);
          lastPersistedSerialized = serialized;
        } catch (error) {
          console.warn("[terminal-registry] Failed to persist registry:", error);
        }
      }
    })().finally(() => {
      writeLoopPromise = null;

      if (pendingSerialized !== null) {
        void runWriteLoop();
      }
    });

    return writeLoopPromise;
  };

  const clearDebounceTimer = () => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };

  const flush = async () => {
    clearDebounceTimer();
    await runWriteLoop();
  };

  return {
    schedulePersist(state: TerminalRegistryState) {
      const serialized = serializeTerminalRegistry(state);

      if (
        serialized === pendingSerialized ||
        (pendingSerialized === null &&
          writeLoopPromise === null &&
          serialized === lastPersistedSerialized)
      ) {
        return;
      }

      pendingSerialized = serialized;
      clearDebounceTimer();
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void runWriteLoop();
      }, REGISTRY_PERSIST_DEBOUNCE_MS);
    },

    flush,

    async close() {
      await flush();
    },
  };
};
