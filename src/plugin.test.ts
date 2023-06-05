import { expect, test } from "vitest";
import { mockEnvironment, testConfig } from "@inlang/core/test";
import { setupConfig } from "@inlang/core/config";
import fs from "node:fs/promises";

test("inlang's config validation should pass", async () => {
  const env = await mockEnvironment({
    copyDirectory: {
      fs: fs,
      paths: ["./dist", "./example"],
    },
  });

  const module = await import("../inlang.config.js");

  const config = await setupConfig({ module, env });

  const [isOk, error] = await testConfig({ config });
  if (error) {
    throw error;
  }
  expect(isOk).toBe(true);
});

test("inlang's config validation should pass with new language", async () => {
  // create random string as new language
  const randomLanguageName = Math.random().toString(36).substring(7);

  const env = await mockEnvironment({
    copyDirectory: {
      fs: fs,
      paths: ["./dist", "./example"],
    },
  });

  const module = await import("../inlang.config.js");

  const config = await setupConfig({ module, env });

  const resources = await config.readResources({ config });

  // add new language
  await config.writeResources({config, resources: [
    ...resources,
    {
      type: "Resource",
      languageTag: {
        type: "LanguageTag",
        name: randomLanguageName,
      },
      body: [],
    }]
  })

  const newConfig = await setupConfig({ module, env });
  
  // check if new language is added
  expect(newConfig.languages).toContain(randomLanguageName);

  const [isOk, error] = await testConfig({ config: newConfig });
  if (error) {
    throw error;
  }

  expect(isOk).toBe(true);
});

