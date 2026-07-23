import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", "dist"],
    server: {
      deps: {
        inline: ["@oppulence/design-system"],
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/index.ts",
        "**/*.d.ts",
        // Browser-only (measurement/DOM) code is covered by Storybook play tests, not jsdom unit tests.
        "src/renderer/**",
        "src/viewport/rect-cache.ts",
      ],
    },
  },
});
