import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    // tsup injects this at build time; without it the source falls back to
    // "0+unknown" and the User-Agent assertions would be testing the fallback.
    __ADSEFID_SDK_VERSION__: JSON.stringify("0.0.0-test"),
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
