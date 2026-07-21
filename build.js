/**
 * Bundles the plugin into a single, self-contained ES module (dist/index.js)
 * that inlang apps can load directly from a CDN like jsDelivr.
 */
import { context } from "esbuild";

const isProduction = process.env.NODE_ENV === "production";

const ctx = await context({
  entryPoints: ["./src/index.ts"],
  outdir: "./dist",
  bundle: true,
  format: "esm",
  platform: "browser",
  // allow top level await
  target: "es2022",
  minify: isProduction,
  sourcemap: false,
});

if (isProduction === false) {
  await ctx.watch();
  console.info("👀 watching for changes...");
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.info("✅ build complete");
}
