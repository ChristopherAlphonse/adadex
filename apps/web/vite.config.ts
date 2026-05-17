import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiProxyTarget =
  process.env.ADADEX_API_ORIGIN ?? process.env.OCTOGENT_API_ORIGIN ?? "http://127.0.0.1:8787";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Prefer TypeScript sources over stale emitted .js siblings in src/.
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
} as never);
