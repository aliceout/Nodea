import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/ 
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // écoute sur 0.0.0.0
    port: 8089, // port forcé
    strictPort: true, // échoue si 8089 n'est pas libre
  },
});
