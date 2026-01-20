import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "cli/ui": "src/cli/ui.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  shims: true,
  splitting: false,
  sourcemap: true,
  minify: false,
  onSuccess: "node scripts/copy-ui-template.mjs",
  external: ["handlebars", "zod"],
});
