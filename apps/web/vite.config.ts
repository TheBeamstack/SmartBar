import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// SmartBar SPA (P2/M2). Vite consumes the workspace engine packages (@rebarconfig/core,
// @rebarconfig/codepacks) directly from their raw-TS `src/` entry — they are excluded from
// dep pre-bundling so Vite runs them through its own TS transform pipeline. This is why no
// separate `dist` build of core is needed for the browser (current_state.md §7.2): Vite
// transpiles the workspace TS on the fly, same as vitest/tsx do headlessly.
export default defineConfig({
  plugins: [react()],
  // SmartBar dev port on the dev box (5173 is Planitor's convention — see cross-project ports).
  server: { port: 5180, strictPort: true, host: "127.0.0.1" },
  preview: { port: 5180, strictPort: true, host: "127.0.0.1" },
  optimizeDeps: {
    // Workspace engine/exporter packages ship raw TS — exclude them from pre-bundling so Vite runs
    // them through its own TS transform (same reasoning as core/codepacks, current_state.md §7.2).
    // pdf-lib (a transitive dep of @rebarconfig/exporters) is normal JS and pre-bundles fine.
    exclude: ["@rebarconfig/core", "@rebarconfig/codepacks", "@rebarconfig/exporters"],
  },
  build: {
    // P6 code-split: keep the heavy 3D vendor (three + r3f/drei) in its own long-cached chunk,
    // separate from the app + the engine. pdf-lib is already lazy (dynamic-imported in exportPdf).
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three", "@react-three/fiber", "@react-three/drei"],
        },
      },
    },
  },
});
