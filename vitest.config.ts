import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.spec.ts"],
    environment: "node",
    globals: false,
    coverage: {
      // P6 (§11): ≥90% on the engine's solver + validation. `npm run coverage` enforces it.
      provider: "v8",
      include: ["packages/core/src/**"],
      // Type-only contracts (interfaces / unions) have no runtime to cover — excluding them keeps
      // the percentage meaningful (it measures the solver/validation/geometry logic, not the types).
      exclude: ["packages/core/src/types/**", "packages/core/src/section/types.ts"],
      reporter: ["text-summary", "html"],
      thresholds: { statements: 90, functions: 90, lines: 90 },
    },
  },
});
