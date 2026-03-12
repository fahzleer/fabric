import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    outDir: "public/css",
    emptyOutDir: false,
    cssMinify: true,
    rollupOptions: {
      input: "./src/styles/input.css",
      output: {
        assetFileNames: "style.css",
      },
    },
  },
  css: {
    devSourcemap: true,
  },
});
