// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { visualizer } from "rollup-plugin-visualizer";
import path from "path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Bundle analyzer (FRONT-03) — emits `dist/stats.html` after every
    // prod build. `gzipSize` + `brotliSize` give the realistic over-
    // the-wire weight, not the unminified raw size which is misleading.
    // Only attached to `build`, never to dev (the plugin's overhead
    // would slow HMR for no benefit). Open the file with any browser.
    visualizer({
      filename: "dist/stats.html",
      gzipSize: true,
      brotliSize: true,
      template: "treemap",
    }),
  ],
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
  // Pre-bundle the lazy-imported heavy libs at dev startup: exceljs (.xlsx
  // export + import), fflate (the .ods export + the encrypted-backup ZIP), and
  // age-encryption (the encrypted-backup seal/open). They're only reached
  // through `await import(...)`, so without this Vite discovers them on first
  // click and force-reloads the page to re-optimise — which drops the
  // in-memory main key (logout).
  optimizeDeps: {
    include: ["exceljs", "fflate", "age-encryption"],
  },
  // Manual chunks (FRONT-10) — without these, Vite bundles every
  // shared dep into a single 1.4 MB main chunk that has to download
  // before *any* page renders. By splitting the heaviest stable libs
  // into their own chunks, browsers can cache them across deploys
  // (chunk hash only changes when the lib version changes, not when
  // app code is edited) and parallel-fetch them on first load.
  //
  // Groupings :
  //   - `react-vendor` : the React runtime + router. Stable, big,
  //     hits every page.
  //   - `crypto` : OPAQUE + WebAuthn + BIP39. Heavy (~200 KB raw)
  //     and only consumed by the auth flow ; lazy-loaded gives the
  //     post-login pages a zero-import-cost.
  //   - `markdown` : react-markdown + its remark/rehype plugin
  //     graph. Used by the Composer + Library 4ᵉ de couv + Docs ;
  //     splitting lets the rest of the app skip it.
  //   - `headlessui` : @headlessui/react. Common across the modals,
  //     stable.
  //   - `zxcvbn` : @zxcvbn-ts/core + the common language dictionary
  //     (top-10k passwords list + adjacency graph). ~240 KB gzip,
  //     used by Register / ChangePassword / Recover /
  //     BackupExport — all lazy-loaded auth pages. The explicit
  //     manualChunk slot just gives it a stable readable name
  //     (`zxcvbn-*`) instead of the auto-generated `index.esm-*`,
  //     so a future audit sees at a glance what the cold-path 240
  //     KB chunk represents.
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          headlessui: ["@headlessui/react"],
          crypto: [
            "@serenity-kit/opaque",
            "@simplewebauthn/browser",
            "@scure/bip39",
          ],
          markdown: ["react-markdown"],
          zxcvbn: ["@zxcvbn-ts/core", "@zxcvbn-ts/language-common"],
        },
      },
    },
  },
});
