import { readFileSync } from "node:fs";
import { defineConfig } from "tsdown";

const packageJson = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version: string };

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2022",
  platform: "node",
  // Keep the file names package.json has always published (index.js / index.d.ts for ESM).
  outExtensions: ({ format }) =>
    format === "es" ? { js: ".js", dts: ".d.ts" } : { js: ".cjs", dts: ".d.cts" },
  define: {
    __ADSEFID_SDK_VERSION__: JSON.stringify(packageJson.version),
  },
});
