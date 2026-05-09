import { builtinModules } from "node:module";
import { resolve } from "node:path";

import { defineConfig } from "vite";

const externals = [
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
  "node-pty",
  "ws",
];

export default defineConfig({
  build: {
    outDir: resolve(__dirname, "../../dist/api"),
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "../api/src/cli.ts"),
      formats: ["es"],
      fileName: () => "cli.js",
    },
    minify: false,
    sourcemap: true,
    target: "node22",
    rollupOptions: {
      external: externals,
      output: {
        entryFileNames: "cli.js",
      },
    },
  },
});
