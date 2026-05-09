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
  value !== null && typeof value === "object" && !Array.isArray(value);

export const resolveRuntimeMetadataPath = (projectStateDir: string) =>
  join(projectStateDir, "state", RUNTIME_METADATA_FILENAME);

export const readRuntimeMetadata = (projectStateDir: string): RuntimeMetadata | null => {
  const filePath = resolveRuntimeMetadataPath(projectStateDir);
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
    if (
      !isRecord(parsed) ||
      typeof parsed.apiBaseUrl !== "string" ||
      typeof parsed.host !== "string" ||
      typeof parsed.port !== "number" ||
      !Number.isFinite(parsed.port) ||
      typeof parsed.pid !== "number" ||
      !Number.isFinite(parsed.pid) ||
      typeof parsed.startedAt !== "string" ||
      typeof parsed.workspaceCwd !== "string"
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
