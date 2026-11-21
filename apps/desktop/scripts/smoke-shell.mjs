import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import electron from "electron";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const built = spawnSync(process.execPath, [join(root, "scripts/build-shell.mjs")], {
  stdio: "inherit",
});

if (built.status !== 0) process.exit(built.status ?? 1);

// Some hosts (VS Code, for one) set ELECTRON_RUN_AS_NODE, which makes Electron start as plain Node. Clear it.
// Jobs are written under the project folder, so the smoke run gets a throwaway one.
const project = mkdtempSync(join(tmpdir(), "adadex-smoke-project-"));

const env = { ...process.env, ADADEX_SMOKE: "1", ADADEX_PROJECT: project };

delete env.ELECTRON_RUN_AS_NODE;

const run = spawnSync(electron, [join(root, "dist/main.mjs")], {
  env,
  encoding: "utf8",
  timeout: 60000,
});

const line = run.stdout.split("\n").find((l) => l.startsWith("SMOKE_RESULT "));

rmSync(project, { recursive: true, force: true });

console.log(line ?? `no result (exit ${run.status})\n${run.stderr.slice(-800)}`);

process.exit(line ? 0 : 1);
