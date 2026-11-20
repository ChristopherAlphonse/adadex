import { isNumber, isObjectValue, isString } from "@adadex/core";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type RuntimeMetadata = {
  apiBaseUrl: string;
  host: string;
  port: number;
  pid: number;
  startedAt: string;
  workspaceCwd: string;
};

const RUNTIME_METADATA_FILENAME = "runtime.json";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && isObjectValue(value) && !Array.isArray(value);

export const resolveRuntimeMetadataPath = (projectStateDir: string) =>
  join(projectStateDir, "state", RUNTIME_METADATA_FILENAME);

export const readRuntimeMetadata = (projectStateDir: string): RuntimeMetadata | null => {
  const filePath = resolveRuntimeMetadataPath(projectStateDir);

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const parsed = /* SAFETY: preceding checks establish the invariant this assertion encodes. */ JSON.parse(readFileSync(filePath, "utf8")) as unknown;

    if (
      !isRecord(parsed) ||
      !isString(parsed.apiBaseUrl) ||
      !isString(parsed.host) ||
      !isNumber(parsed.port) ||
      !Number.isFinite(parsed.port) ||
      !isNumber(parsed.pid) ||
      !Number.isFinite(parsed.pid) ||
      !isString(parsed.startedAt) ||
      !isString(parsed.workspaceCwd)
    ) {
      return null;
    }

    return {
      apiBaseUrl: parsed.apiBaseUrl,
      host: parsed.host,
      port: parsed.port,
      pid: parsed.pid,
      startedAt: parsed.startedAt,
      workspaceCwd: parsed.workspaceCwd,
    };
  } catch {
    return null;
  }
};

export const writeRuntimeMetadata = (projectStateDir: string, metadata: RuntimeMetadata) => {
  const filePath = resolveRuntimeMetadataPath(projectStateDir);
  mkdirSync(join(projectStateDir, "state"), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
};

export const clearRuntimeMetadata = (projectStateDir: string) => {
  const filePath = resolveRuntimeMetadataPath(projectStateDir);

  if (!existsSync(filePath)) {
    return;
  }

  rmSync(filePath, { force: true });
};
