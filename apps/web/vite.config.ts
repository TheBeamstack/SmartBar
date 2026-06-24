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
    exclude: ["@rebarconfig/core", "@rebarconfig/codepacks"],
  },
});
