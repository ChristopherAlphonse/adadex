import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
const apiProxyTarget = process.env.ADADEX_API_ORIGIN ?? process.env.OCTOGENT_API_ORIGIN ?? "http://127.0.0.1:8787";
export default defineConfig({
    plugins: [react()],
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
});
