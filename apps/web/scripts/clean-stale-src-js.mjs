import { readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const srcRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..", "src");

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".js")) {
      await unlink(fullPath);
    }
  }
};

await walk(srcRoot);
