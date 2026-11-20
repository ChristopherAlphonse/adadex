import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { writeTextFileAtomic } from "../src/atomicJsonFile";

describe("writeTextFileAtomic", () => {
  const directories: string[] = [];

  const createTemporaryDirectory = () => {
    const directory = mkdtempSync(join(tmpdir(), "adadex-atomic-write-test-"));
    directories.push(directory);
    return directory;
  };

  afterEach(() => {
    for (const directory of directories) {
      rmSync(directory, { recursive: true, force: true });
    }
    directories.length = 0;
  });

  it("replaces the target with a rename and leaves no temporary file behind", () => {
    const directory = createTemporaryDirectory();
    const target = join(directory, "processes.json");
    writeFileSync(target, '{"version":0}\n', "utf8");

    writeTextFileAtomic(target, '{"version":1}\n', { token: () => "fixed" });

    expect(readFileSync(target, "utf8")).toBe('{"version":1}\n');
    expect(readdirSync(directory)).toEqual(["processes.json"]);
  });

  it("keeps the original target intact when the temporary write fails", () => {
    const directory = createTemporaryDirectory();
    const target = join(directory, "processes.json");
    const original = '{"version":0}\n';
    writeFileSync(target, original, "utf8");
    const remove = vi.fn();

    expect(() =>
      writeTextFileAtomic(target, '{"version":1}\n', {
        token: () => "fixed",
        writeFile: () => {
          throw new Error("disk full");
        },
        remove,
      }),
    ).toThrow("disk full");

    expect(readFileSync(target, "utf8")).toBe(original);
    expect(remove).toHaveBeenCalledWith(join(directory, "processes.json.fixed.tmp"));
  });

  it("keeps the original target intact when the rename fails", () => {
    const directory = createTemporaryDirectory();
    const target = join(directory, "processes.json");
    const original = '{"version":0}\n';
    writeFileSync(target, original, "utf8");
    const remove = vi.fn();

    expect(() =>
      writeTextFileAtomic(target, '{"version":1}\n', {
        token: () => "fixed",
        rename: () => {
          throw new Error("rename failed");
        },
        remove,
      }),
    ).toThrow("rename failed");

    expect(readFileSync(target, "utf8")).toBe(original);
    expect(remove).toHaveBeenCalledWith(join(directory, "processes.json.fixed.tmp"));
  });
});
