import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import wasm from "vite-plugin-wasm";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), wasm(), tailwindcss()],
  server: {
    host: true, // écoute sur 0.0.0.0
    port: 8089, // port forcé
    strictPort: true, // échoue si 8089 n'est pas libre
  },
});
