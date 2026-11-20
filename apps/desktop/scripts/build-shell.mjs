import { execFileSync } from "node:child_process";
import { copyFile, cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = join(root, "..", "..");
const out = join(root, "dist");
await mkdir(out, { recursive: true });

execFileSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "build", "--workspace=@adadex/web"],
  {
    cwd: workspaceRoot,
    stdio: "inherit",
  },
);
await rm(join(out, "web"), { recursive: true, force: true });
await cp(join(workspaceRoot, "apps/web/dist"), join(out, "web"), { recursive: true });

await build({
  entryPoints: [join(root, "src/shell/main.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  outfile: join(out, "main.mjs"),
  external: ["electron"],
  logLevel: "warning",
});

const copies = [
  ["src/shell/preload.cjs", "preload.cjs"],
  ["src/shell/index.html", "index.html"],
  ["src/shell/renderer.js", "renderer.js"],
  ["src/shell/renderer.css", "renderer.css"],
  ["src/agents/mcp-bridge.mjs", "mcp-bridge.mjs"],
  ["src/agents/guard-hook.mjs", "guard-hook.mjs"],
];
for (const [from, to] of copies) await copyFile(join(root, from), join(out, to));
console.log("built dist/");
