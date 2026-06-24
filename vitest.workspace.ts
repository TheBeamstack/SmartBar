import { defineWorkspace } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Two test projects:
 *  - "core": the headless engine + contract suites (node env) — unchanged from P0/P1.
 *  - "web":  the P2 SPA (jsdom env, React plugin) — store/mapping/perf logic + RTL smoke.
 * `npm run test` (vitest run) executes both.
 */
export default defineWorkspace([
  {
    extends: "./vitest.config.ts",
    test: { name: "core" },
  },
  {
    plugins: [react()],
    test: {
      name: "web",
      include: ["apps/web/src/**/*.spec.{ts,tsx}"],
      environment: "jsdom",
      globals: true,
      setupFiles: ["apps/web/vitest.setup.ts"],
    },
  },
]);
