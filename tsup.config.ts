import { defineConfig } from "tsup";

/**
 * Global tsup config — used by ALL services via:
 *   "build": "tsup --config ../../tsup.config.ts"
 *
 * Dev mode uses `tsx watch src/index.ts` directly (see each service's
 * package.json "dev" script) — no tsup involved in dev, so there is
 * no dist/ path race condition or CWD mismatch.
 *
 * tsup picks up tsconfig.json from the CWD (the service folder) so
 * each service's own tsconfig is used for type resolution.
 */
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  minify: process.env.NODE_ENV === "production",
  tsconfig: "tsconfig.json",
  // Resolve @/* → ./src/* at bundle time — no runtime tsconfig-paths needed
  esbuildOptions(options) {
    options.alias = { "@": "./src" };
  },
  // No onSuccess here — dev doesn't use tsup at all (uses tsx watch instead)
});
