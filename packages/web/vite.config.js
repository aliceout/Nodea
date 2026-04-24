// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Read env files from the repo root so `VITE_API_URL` (and any other
  // VITE_* var) stays in the single canonical `.env` written by Dev
  // Setup / Infisical — no per-package duplicate.
  envDir: path.resolve(__dirname, "../.."),
  server: {
    host: true,
    port: 8089,
    strictPort: true,
    proxy: {
      // Forward /api/* to the local Hono dev server so the SPA + API
      // share the same origin in dev — browsers then send the session
      // cookie natively and SameSite=Lax stays happy. Mirrors the
      // production layout where nginx reverse-proxies /api to the
      // api container.
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@app": path.resolve(__dirname, "src/app"),
      "@core": path.resolve(__dirname, "src/core"),
      "@i18n": path.resolve(__dirname, "src/i18n"),
      "@ui": path.resolve(__dirname, "src/ui"),
    },
  },
});
