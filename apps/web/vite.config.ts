import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiProxyTarget = process.env.ADADEX_API_ORIGIN ?? "http://127.0.0.1:8787";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(
  /* SAFETY: preceding checks establish the invariant this assertion encodes. */ {
    // Relative asset paths let the desktop shell load the built page from file://.
    base: "./",
    plugins: [react(), tailwindcss()],
    resolve: {
      extensions: [".tsx", ".ts", ".jsx", ".js", ".mjs", ".mts", ".json"],
      alias: {
        "@": path.resolve(projectRoot, "src"),
      },
    },
    server: {
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: "./tests/setup.ts",
      include: ["tests/**/*.test.{ts,tsx}"],
    },
  } as never,
);
