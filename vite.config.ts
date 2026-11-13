import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";

function htmlVersionPlugin(): Plugin {
  return {
    name: "html-version-transform",
    transformIndexHtml(html) {
      try {
        const pkg = JSON.parse(
          fs.readFileSync(new URL("./package.json", import.meta.url), "utf-8")
        );
        return html.replace(
          /<title>.*?<\/title>/,
          `<title>Trellis Kanban Board v${pkg.version}</title>`
        );
      } catch {
        return html;
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), htmlVersionPlugin()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "esnext",
    outDir: "dist",
  },
});
