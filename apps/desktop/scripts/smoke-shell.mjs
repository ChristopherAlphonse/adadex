import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import electron from "electron";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const built = spawnSync(process.execPath, [join(root, "scripts/build-shell.mjs")], {
  stdio: "inherit",
});
if (built.status !== 0) process.exit(built.status ?? 1);
// Some hosts (VS Code, for one) set ELECTRON_RUN_AS_NODE, which makes Electron start as plain Node. Clear it.
const env = { ...process.env, ADADEX_SMOKE: "1" };
delete env.ELECTRON_RUN_AS_NODE;
const run = spawnSync(electron, [join(root, "dist/main.mjs")], {
  env,
  encoding: "utf8",
  timeout: 60000,
});
const line = run.stdout.split("\n").find((l) => l.startsWith("SMOKE_RESULT "));
console.log(line ?? `no result (exit ${run.status})\n${run.stderr.slice(-800)}`);
process.exit(line ? 0 : 1);
