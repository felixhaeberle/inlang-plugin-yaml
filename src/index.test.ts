// @ts-ignore
import { defineConfig } from "../example/inlang.config.js";
import { expect, test } from "vitest";
import { mockEnvironment, validateConfig } from "@inlang/core/test";
import fs from "node:fs/promises";

test("inlang's config validation should pass", async () => {
  const env = await mockEnvironment({
    copyDirectory: {
      // @ts-expect-error - Type issues until inlang fixes the filesystem types.
      fs: fs,
      paths: ["./dist", "./example"],
    },
  });

  // setting the current working directory to the example directory
  // that contains the inlang.config.js file
  const currentWorkingDirectory = process.cwd();
  process.cwd = () => currentWorkingDirectory + "/example";

  const config = await defineConfig(env);
  const result = await validateConfig({ config });
  if (result.isErr) {
    throw result.error;
  }
  expect(result.isOk).toBe(true);
});
