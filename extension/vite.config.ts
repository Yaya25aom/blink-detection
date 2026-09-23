import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(import.meta.dirname, "src/background.ts"),
        authBridge: resolve(import.meta.dirname, "src/content/authBridge.ts"),
        offscreen: resolve(import.meta.dirname, "src/offscreen/offscreen.html"),
        popup: resolve(import.meta.dirname, "src/popup/popup.html"),
      },
      output: {
        entryFileNames: (chunk) => ["background", "authBridge"].includes(chunk.name)
          ? `${chunk.name}.js`
          : "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
