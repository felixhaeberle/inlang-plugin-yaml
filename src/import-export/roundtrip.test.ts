import { expect, test } from "vitest";
import { parse } from "yaml";
import { importFiles } from "./importFiles.js";
import { exportFiles } from "./exportFiles.js";
import { PLUGIN_KEY } from "../pluginKey.js";
import type { ExportFile, ProjectSettings } from "../types.js";

async function exportImported(
  imported: Awaited<ReturnType<typeof importFiles>>,
  settings: ProjectSettings = {},
) {
  return exportFiles({
    settings,
    bundles: imported.bundles,
    messages: imported.messages as Parameters<
      typeof exportFiles
    >[0]["messages"],
    variants: imported.variants,
  });
}

function parseFile(file: ExportFile): unknown {
  return parse(new TextDecoder().decode(file.content));
}

function encode(yaml: string): Uint8Array {
  return new TextEncoder().encode(yaml);
}

test("imports and exports YAML while preserving nested and dotted keys", async () => {
  const imported = await importFiles({
    settings: {},
    files: [
      {
        locale: "en",
        content: encode(
          [
            "title: Hello {name}",
            "nested:",
            "  body: Welcome",
            '"flat.dotted": Stay flat',
            'empty: ""',
          ].join("\n"),
        ),
      },
    ],
  });

  expect(imported.bundles).toEqual([
    {
      id: "title",
      declarations: [{ type: "input-variable", name: "name" }],
    },
    { id: "nested.body", declarations: [] },
    { id: "flat.dotted", declarations: [] },
    { id: "empty", declarations: [] },
  ]);
  expect(imported.variants[0]?.pattern).toEqual([
    { type: "text", value: "Hello " },
    { type: "expression", arg: { type: "variable-reference", name: "name" } },
  ]);

  const exported = await exportImported(imported);
  expect(exported).toHaveLength(1);
  expect(exported[0]?.name).toBe("en.yaml");
  expect(parseFile(exported[0]!)).toEqual({
    title: "Hello {name}",
    nested: { body: "Welcome" },
    "flat.dotted": "Stay flat",
    empty: "",
  });
});

test("coerces unquoted scalars (numbers, booleans) to strings instead of dropping them", async () => {
  const imported = await importFiles({
    settings: {},
    files: [
      {
        locale: "en",
        content: encode("version: 42\nenabled: true\n"),
      },
    ],
  });

  expect(imported.bundles.map((bundle) => bundle.id)).toEqual([
    "version",
    "enabled",
  ]);
  expect(imported.variants.map((variant) => variant.pattern)).toEqual([
    [{ type: "text", value: "42" }],
    [{ type: "text", value: "true" }],
  ]);
});

test("supports Rails-style files with the locale as root key and %{} variables", async () => {
  const settings = {
    [PLUGIN_KEY]: {
      pathPattern: "./config/locales/{locale}.yml",
      variableReferencePattern: ["%{", "}"],
      localeAsRootKey: true,
    },
  };
  const railsYaml = [
    "en:",
    '  hello: "Hi %{user}!"',
    "  activerecord:",
    "    errors: Something went wrong",
  ].join("\n");

  const imported = await importFiles({
    settings,
    files: [{ locale: "en", content: encode(railsYaml) }],
  });

  expect(imported.bundles).toEqual([
    { id: "hello", declarations: [{ type: "input-variable", name: "user" }] },
    { id: "activerecord.errors", declarations: [] },
  ]);

  const exported = await exportImported(imported, settings);
  expect(exported[0]?.name).toBe("en.yml");
  expect(parseFile(exported[0]!)).toEqual({
    en: {
      hello: "Hi %{user}!",
      activerecord: { errors: "Something went wrong" },
    },
  });
});

test("resolves YAML merge keys and anchors", async () => {
  const imported = await importFiles({
    settings: {},
    files: [
      {
        locale: "en",
        content: encode(
          [
            "defaults: &defaults",
            "  greeting: Hello",
            "page:",
            "  <<: *defaults",
            "  farewell: Bye",
          ].join("\n"),
        ),
      },
    ],
  });

  expect(imported.bundles.map((bundle) => bundle.id)).toEqual([
    "defaults.greeting",
    "page.greeting",
    "page.farewell",
  ]);
});

test("uses colon-delimited bundle IDs for namespaces", async () => {
  const settings = {
    [PLUGIN_KEY]: {
      pathPattern: {
        common: "./messages/{locale}/common.yaml",
        auth: "./messages/{locale}/auth.yaml",
      },
    },
  };
  const imported = await importFiles({
    settings,
    files: [
      {
        locale: "en",
        content: encode("header:\n  title: Welcome\n"),
        toBeImportedFilesMetadata: { namespace: "common" },
      },
      {
        locale: "en",
        content: encode("signIn: Sign in\n"),
        toBeImportedFilesMetadata: { namespace: "auth" },
      },
    ],
  });

  expect(imported.bundles.map((bundle) => bundle.id)).toEqual([
    "common:header.title",
    "auth:signIn",
  ]);

  const exported = await exportImported(imported, settings);
  const common = exported.find((file) => file.metadata?.namespace === "common");
  const auth = exported.find((file) => file.metadata?.namespace === "auth");
  expect(common?.name).toBe("common-en.yaml");
  expect(parseFile(common!)).toEqual({ header: { title: "Welcome" } });
  expect(auth?.name).toBe("auth-en.yaml");
  expect(parseFile(auth!)).toEqual({ signIn: "Sign in" });
});

test("throws when exporting selectors or multiple variants", async () => {
  await expect(
    exportFiles({
      settings: {},
      bundles: [{ id: "greeting", declarations: [] }],
      messages: [
        { id: "message-1", bundleId: "greeting", locale: "en", selectors: [] },
      ],
      variants: [
        {
          id: "variant-1",
          messageId: "message-1",
          matches: [],
          pattern: [{ type: "text", value: "a" }],
        },
        {
          id: "variant-2",
          messageId: "message-1",
          matches: [],
          pattern: [{ type: "text", value: "b" }],
        },
      ],
    }),
  ).rejects.toThrow(/not supported/);
});
