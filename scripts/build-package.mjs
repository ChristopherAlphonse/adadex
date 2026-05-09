import { chmodSync, cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(packageRoot, "dist");

const copyDirectory = (sourcePath, destinationPath) => {
  if (!existsSync(sourcePath)) {
    throw new Error(`Missing build input: ${sourcePath}`);
  }

  rmSync(destinationPath, { force: true, recursive: true });
  mkdirSync(dirname(destinationPath), { recursive: true });
  cpSync(sourcePath, destinationPath, { recursive: true });
};

mkdirSync(distDir, { recursive: true });

copyDirectory(join(packageRoot, "prompts"), join(distDir, "prompts"));
copyDirectory(join(packageRoot, "apps", "web", "dist"), join(distDir, "web"));

chmodSync(join(packageRoot, "bin", "adadex"), 0o755);
