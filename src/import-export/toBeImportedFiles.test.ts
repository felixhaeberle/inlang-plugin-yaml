import { expect, test } from "vitest";
import { toBeImportedFiles } from "./toBeImportedFiles.js";
import { PLUGIN_KEY } from "../pluginKey.js";

test("resolves one file per locale for a plain path pattern", async () => {
  const result = await toBeImportedFiles({
    settings: {
      baseLocale: "en",
      locales: ["en", "de"],
      [PLUGIN_KEY]: { pathPattern: "./messages/{locale}.yaml" },
    },
  });

  expect(result).toEqual([
    { locale: "en", path: "./messages/en.yaml" },
    { locale: "de", path: "./messages/de.yaml" },
  ]);
});

test("supports the legacy {languageTag} placeholder and languageTags setting", async () => {
  const result = await toBeImportedFiles({
    settings: {
      sourceLanguageTag: "en",
      languageTags: ["en"],
      [PLUGIN_KEY]: { pathPattern: "./messages/{languageTag}.yml" },
    },
  });

  expect(result).toEqual([{ locale: "en", path: "./messages/en.yml" }]);
});

test("resolves namespaced path patterns with metadata", async () => {
  const result = await toBeImportedFiles({
    settings: {
      baseLocale: "en",
      locales: ["en", "de"],
      [PLUGIN_KEY]: {
        pathPattern: {
          common: "./messages/{locale}/common.yaml",
          app: "./messages/{locale}/app.yaml",
        },
      },
    },
  });

  expect(result).toEqual([
    {
      locale: "en",
      path: "./messages/en/common.yaml",
      metadata: { namespace: "common" },
    },
    {
      locale: "en",
      path: "./messages/en/app.yaml",
      metadata: { namespace: "app" },
    },
    {
      locale: "de",
      path: "./messages/de/common.yaml",
      metadata: { namespace: "common" },
    },
    {
      locale: "de",
      path: "./messages/de/app.yaml",
      metadata: { namespace: "app" },
    },
  ]);
});

test("returns an empty list when the plugin settings are missing", async () => {
  const result = await toBeImportedFiles({
    settings: { baseLocale: "en", locales: ["en"] },
  });
  expect(result).toEqual([]);
});
