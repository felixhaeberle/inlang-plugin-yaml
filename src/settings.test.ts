import { expect, test } from "vitest";
import { Value } from "@sinclair/typebox/value";
import { PluginSettings } from "./settings.js";

test("accepts a plain path pattern with {locale}", () => {
  expect(
    Value.Check(PluginSettings, { pathPattern: "./messages/{locale}.yaml" }),
  ).toBe(true);
  expect(
    Value.Check(PluginSettings, {
      pathPattern: "./config/locales/{locale}.yml",
    }),
  ).toBe(true);
  expect(
    Value.Check(PluginSettings, {
      pathPattern: "../i18n/{languageTag}/translation.yaml",
    }),
  ).toBe(true);
});

test("accepts namespaced path patterns", () => {
  expect(
    Value.Check(PluginSettings, {
      pathPattern: {
        common: "./messages/{locale}/common.yaml",
        app: "./messages/{locale}/app.yml",
      },
    }),
  ).toBe(true);
});

test("accepts optional settings", () => {
  expect(
    Value.Check(PluginSettings, {
      pathPattern: "./config/locales/{locale}.yml",
      variableReferencePattern: ["%{", "}"],
      localeAsRootKey: true,
    }),
  ).toBe(true);
});

test("rejects invalid settings", () => {
  // missing pathPattern
  expect(Value.Check(PluginSettings, {})).toBe(false);
  // missing {locale} placeholder
  expect(
    Value.Check(PluginSettings, { pathPattern: "./messages/en.yaml" }),
  ).toBe(false);
  // wrong extension
  expect(
    Value.Check(PluginSettings, { pathPattern: "./messages/{locale}.json" }),
  ).toBe(false);
  // wildcards are not supported
  expect(
    Value.Check(PluginSettings, { pathPattern: "./**/{locale}.yaml" }),
  ).toBe(false);
  // namespaces must not contain dots
  expect(
    Value.Check(PluginSettings, {
      pathPattern: { "my.namespace": "./messages/{locale}.yaml" },
    }),
  ).toBe(false);
});
