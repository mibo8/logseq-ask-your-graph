import { defineConfig } from "vite"
import logseqPlugin from "vite-plugin-logseq"
import path from "path"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [logseqPlugin()],
  build: {
    target: "esnext",
    minify: "esbuild",
    sourcemap: true,
    chunkSizeWarningLimit: 10000,
    cssCodeSplit: false,
    outDir: "dist",
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
      },
      output: {
        manualChunks: () => "index.js",
      },
    },
  },
})
