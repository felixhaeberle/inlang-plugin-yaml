/**
 * This is the build script for the project.
 *
 * It takes the source code and bundles it into a single file
 * that can be imported into an inlang project.
 */

import { context } from "esbuild";
import { pluginBuildConfig } from "@inlang/core/utilities";

const ctx = await context(
  await pluginBuildConfig({
    entryPoints: ["src/index.ts"],
    outfile: "dist/index.js",
    // minification is disabled in dev mode for better debugging
    minify: !process.env.DEV,
  })
);

if (process.env.DEV) {
  await ctx.watch();
  console.info("👀 watching for changes...");
} else {
  await ctx.rebuild();
  console.info("✅ build complete");
  await ctx.dispose();
}
