import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// VENDOR: a folder created by prepare.mjs. CSS: which stylesheet to load from it.
const vendor = process.env.VENDOR ?? "vendor/coss";
const css = process.env.CSS ?? "globals.css";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "virtual-css": fileURLToPath(new URL(`./${vendor}/${css}`, import.meta.url)),
      "@": fileURLToPath(new URL(`./${vendor}`, import.meta.url)),
    },
  },
  build: { minify: false, outDir: process.env.OUT_DIR ?? "dist" },
});
