import { randomUUID } from "node:crypto";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { mkdir, rename as renameFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

type SyncWriteDependencies = {
  ensureDir?: (path: string) => void;
  writeFile?: (path: string, contents: string) => void;
  rename?: (from: string, to: string) => void;
  remove?: (path: string) => void;
  token?: () => string;
};

type AsyncWriteDependencies = {
  ensureDir?: (path: string) => Promise<void>;
  writeFile?: (path: string, contents: string) => Promise<void>;
  rename?: (from: string, to: string) => Promise<void>;
  remove?: (path: string) => Promise<void>;
  token?: () => string;
};

const tempPathFor = (targetPath: string, token: () => string) => `${targetPath}.${token()}.tmp`;

/**
 * Writes via a sibling temp file so a crash mid-write cannot leave a truncated
 * registry. The rename is the commit point.
 */
export const writeTextFileAtomic = (
  targetPath: string,
  contents: string,
  dependencies: SyncWriteDependencies = {},
): void => {
  const ensureDir = dependencies.ensureDir ?? ((path) => mkdirSync(path, { recursive: true }));
  const write = dependencies.writeFile ?? ((path, data) => writeFileSync(path, data, "utf8"));
  const rename = dependencies.rename ?? renameSync;
  const remove = dependencies.remove ?? ((path) => rmSync(path, { force: true }));
  const token = dependencies.token ?? randomUUID;

  ensureDir(dirname(targetPath));
  const tempPath = tempPathFor(targetPath, token);
  try {
    write(tempPath, contents);
    rename(tempPath, targetPath);
  } catch (error) {
    try {
      remove(tempPath);
    } catch {
      // Best effort: the target is still intact because rename did not happen.
    }
    throw error;
  }
};

export const writeTextFileAtomicAsync = async (
  targetPath: string,
  contents: string,
  dependencies: AsyncWriteDependencies = {},
): Promise<void> => {
  const ensureDir = dependencies.ensureDir ?? ((path) => mkdir(path, { recursive: true }));
  const write = dependencies.writeFile ?? ((path, data) => writeFile(path, data, "utf8"));
  const rename = dependencies.rename ?? renameFile;
  const remove = dependencies.remove ?? ((path) => rm(path, { force: true }));
  const token = dependencies.token ?? randomUUID;

  await ensureDir(dirname(targetPath));
  const tempPath = tempPathFor(targetPath, token);
  try {
    await write(tempPath, contents);
    await rename(tempPath, targetPath);
  } catch (error) {
    try {
      await remove(tempPath);
    } catch {
      // Best effort: the target is still intact because rename did not happen.
    }
    throw error;
  }
};
