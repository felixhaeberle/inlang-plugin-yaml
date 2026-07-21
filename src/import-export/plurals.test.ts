import { beforeEach, expect, test } from "vitest";
import { parse } from "yaml";
import { importFiles } from "./importFiles.js";
import { exportFiles } from "./exportFiles.js";
import { PLUGIN_KEY } from "../pluginKey.js";
import { clearFileFormatCache } from "../formatCache.js";
import type { ExportFile, ProjectSettings } from "../types.js";

beforeEach(() => {
  clearFileFormatCache();
});

function encode(yaml: string): Uint8Array {
  return new TextEncoder().encode(yaml);
}

function parseFile(file: ExportFile): unknown {
  return parse(new TextDecoder().decode(file.content));
}

async function exportImported(
  imported: Awaited<ReturnType<typeof importFiles>>,
  settings: ProjectSettings = {},
) {
  return exportFiles({
    settings,
    bundles: imported.bundles,
    messages: imported.messages as never,
    variants: imported.variants as never,
  });
}

const cartYaml = [
  "cart:",
  "  items:",
  "    one: One item",
  '    other: "{count} items"',
  "greeting: Hello",
].join("\n");

test("imports a plural group as one message with plural variants", async () => {
  const imported = await importFiles({
    settings: {},
    files: [{ locale: "en", content: encode(cartYaml) }],
  });

  expect(imported.bundles.map((bundle) => bundle.id)).toEqual([
    "cart.items",
    "greeting",
  ]);

  const pluralBundle = imported.bundles[0]!;
  expect(pluralBundle.declarations).toEqual([
    { type: "input-variable", name: "count" },
    {
      type: "local-variable",
      name: "countPlural",
      value: {
        type: "expression",
        arg: { type: "variable-reference", name: "count" },
        annotation: { type: "function-reference", name: "plural", options: [] },
      },
    },
  ]);

  const pluralMessage = imported.messages.find(
    (message) => message.bundleId === "cart.items",
  )!;
  expect(pluralMessage.selectors).toEqual([
    { type: "variable-reference", name: "countPlural" },
  ]);

  const pluralVariants = imported.variants.filter(
    (variant) => variant.messageId === pluralMessage.id,
  );
  expect(pluralVariants).toHaveLength(2);
  expect(pluralVariants[0]!.matches).toEqual([
    { type: "literal-match", key: "countPlural", value: "one" },
  ]);
  expect(pluralVariants[1]!.matches).toEqual([
    { type: "catchall-match", key: "countPlural" },
  ]);
});

test("exports plural variants back to a nested plural group", async () => {
  const imported = await importFiles({
    settings: {},
    files: [{ locale: "en", content: encode(cartYaml) }],
  });
  const [file] = await exportImported(imported);

  expect(parseFile(file!)).toEqual({
    cart: {
      items: {
        one: "One item",
        other: "{count} items",
      },
    },
    greeting: "Hello",
  });
});

test("orders categories canonically in freshly generated files", async () => {
  // preservation off -> the export takes the clean-generation path where
  // canonical CLDR ordering applies (preserved files keep the author's order)
  const settings: ProjectSettings = {
    [PLUGIN_KEY]: {
      pathPattern: "./messages/{locale}.yaml",
      preserveFormatting: false,
    },
  };
  const imported = await importFiles({
    settings,
    files: [
      {
        locale: "ar",
        content: encode(
          [
            "files:",
            "  other: files",
            "  many: many files",
            "  zero: no files",
            "  one: one file",
            "  two: two files",
            "  few: few files",
          ].join("\n"),
        ),
      },
    ],
  });
  const [file] = await exportImported(imported, settings);
  const text = new TextDecoder().decode(file!.content);

  expect(text).toBe(
    [
      "files:",
      "  zero: no files",
      "  one: one file",
      "  two: two files",
      "  few: few files",
      "  many: many files",
      "  other: files",
      "",
    ].join("\n"),
  );
});

test("plurals: false imports plural groups as flat messages", async () => {
  const settings: ProjectSettings = {
    [PLUGIN_KEY]: {
      pathPattern: "./messages/{locale}.yaml",
      plurals: false,
    },
  };
  const imported = await importFiles({
    settings,
    files: [{ locale: "en", content: encode(cartYaml) }],
  });

  expect(imported.bundles.map((bundle) => bundle.id)).toEqual([
    "cart.items.one",
    "cart.items.other",
    "greeting",
  ]);
  expect(
    imported.messages.every(
      (message) => (message.selectors ?? []).length === 0,
    ),
  ).toBe(true);
});

test("mappings that only look plural-ish stay regular messages", async () => {
  const imported = await importFiles({
    settings: {},
    files: [
      {
        locale: "en",
        content: encode(
          [
            // no "other" -> not a plural group
            "steps:",
            "  one: First",
            "  two: Second",
            // non-CLDR key -> not a plural group
            "sizes:",
            "  small: Small",
            "  other: Other",
          ].join("\n"),
        ),
      },
    ],
  });

  expect(imported.bundles.map((bundle) => bundle.id)).toEqual([
    "steps.one",
    "steps.two",
    "sizes.small",
    "sizes.other",
  ]);
});

test("preserves formatting around plural groups", async () => {
  const original = [
    "# cart section",
    "cart:",
    "  items:",
    "    one: One item",
    '    other: "{count} items"',
    "",
  ].join("\n");

  const imported = await importFiles({
    settings: {},
    files: [{ locale: "en", content: encode(original) }],
  });
  const [file] = await exportImported(imported);

  expect(new TextDecoder().decode(file!.content)).toBe(original);
});

test("Rails plural round-trip with %{count} placeholders", async () => {
  const settings: ProjectSettings = {
    [PLUGIN_KEY]: {
      pathPattern: "./config/locales/{locale}.yml",
      variableReferencePattern: ["%{", "}"],
      localeAsRootKey: true,
    },
  };
  const railsYaml = [
    "en:",
    "  inbox:",
    "    one: You have one message",
    '    other: "You have %{count} messages"',
    "",
  ].join("\n");

  const imported = await importFiles({
    settings,
    files: [{ locale: "en", content: encode(railsYaml) }],
  });

  expect(imported.bundles.map((bundle) => bundle.id)).toEqual(["inbox"]);
  const [file] = await exportImported(imported, settings);
  expect(new TextDecoder().decode(file!.content)).toBe(railsYaml);
});
