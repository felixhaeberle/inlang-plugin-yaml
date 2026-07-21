import { beforeEach, expect, test } from "vitest";
import { importFiles } from "./importFiles.js";
import { exportFiles } from "./exportFiles.js";
import { PLUGIN_KEY } from "../pluginKey.js";
import { clearFileFormatCache } from "../formatCache.js";
import type { ExportFile, ProjectSettings } from "../types.js";

beforeEach(() => {
  clearFileFormatCache();
});

const settings: ProjectSettings = {
  [PLUGIN_KEY]: { pathPattern: "./messages/{locale}.yaml" },
};

function encode(yaml: string): Uint8Array {
  return new TextEncoder().encode(yaml);
}

function decode(file: ExportFile): string {
  return new TextDecoder().decode(file.content);
}

async function roundtrip(
  yaml: string,
  mutate?: (
    imported: Awaited<ReturnType<typeof importFiles>>,
  ) => Awaited<ReturnType<typeof importFiles>>,
  customSettings: ProjectSettings = settings,
) {
  let imported = await importFiles({
    settings: customSettings,
    files: [{ locale: "en", content: encode(yaml) }],
  });
  if (mutate !== undefined) {
    imported = mutate(imported);
  }
  const exported = await exportFiles({
    settings: customSettings,
    bundles: imported.bundles,
    messages: imported.messages as never,
    variants: imported.variants as never,
  });
  return exported[0]!;
}

test("preserves comments, key order, blank lines, and quote styles", async () => {
  const original = [
    "# Main navigation labels",
    "menu:",
    "  home: Home # shown in the header",
    '  about: "About us"',
    "",
    "# Farewell message",
    "farewell: Goodbye",
    "greeting: Hello",
    "",
  ].join("\n");

  const file = await roundtrip(original);
  expect(decode(file)).toBe(original);
});

test("only changed values produce changed lines", async () => {
  const original = [
    "# a comment that must survive",
    "greeting: Hello",
    "farewell: Goodbye",
    "",
  ].join("\n");

  const file = await roundtrip(original, (imported) => {
    const variant = imported.variants.find((candidate) =>
      candidate.messageId.includes("greeting"),
    )!;
    variant.pattern = [{ type: "text", value: "Hi there" }];
    return imported;
  });

  expect(decode(file)).toBe(
    [
      "# a comment that must survive",
      "greeting: Hi there",
      "farewell: Goodbye",
      "",
    ].join("\n"),
  );
});

test("retains non-message content: arrays, nulls, and unquoted scalars", async () => {
  const original = [
    "weekdays:",
    "  - Monday",
    "  - Tuesday",
    "placeholder: null",
    "version: 42",
    "greeting: Hello",
    "",
  ].join("\n");

  const file = await roundtrip(original);
  // arrays/nulls are not messages but must survive the round-trip;
  // the unquoted number must stay unquoted (not become "42")
  expect(decode(file)).toBe(original);
});

test("removes deleted messages and prunes emptied parents", async () => {
  const original = [
    "menu:",
    "  home: Home",
    "greeting: Hello",
    "",
  ].join("\n");

  const file = await roundtrip(original, (imported) => {
    const homeMessage = imported.messages.find((message) =>
      message.bundleId.includes("menu.home"),
    )!;
    return {
      bundles: imported.bundles.filter(
        (bundle) => bundle.id !== homeMessage.bundleId,
      ),
      messages: imported.messages.filter(
        (message) => message.bundleId !== homeMessage.bundleId,
      ),
      variants: imported.variants.filter(
        (variant) => variant.messageId !== homeMessage.id,
      ),
    };
  });

  expect(decode(file)).toBe(["greeting: Hello", ""].join("\n"));
});

test("newly added messages are appended", async () => {
  const original = ["# header", "greeting: Hello", ""].join("\n");

  const file = await roundtrip(original, (imported) => {
    imported.bundles.push({ id: "farewell", declarations: [] });
    imported.messages.push({
      id: "new-message",
      bundleId: "farewell",
      locale: "en",
      selectors: [],
    });
    imported.variants.push({
      id: "new-variant",
      messageId: "new-message",
      matches: [],
      pattern: [{ type: "text", value: "Goodbye" }],
    });
    return imported;
  });

  expect(decode(file)).toBe(
    ["# header", "greeting: Hello", "farewell: Goodbye", ""].join("\n"),
  );
});

test("detects and keeps 4-space indentation", async () => {
  const original = ["menu:", "    home: Home", ""].join("\n");
  const file = await roundtrip(original);
  expect(decode(file)).toBe(original);
});

test("preserveFormatting: false regenerates a clean file", async () => {
  const customSettings: ProjectSettings = {
    [PLUGIN_KEY]: {
      pathPattern: "./messages/{locale}.yaml",
      preserveFormatting: false,
    },
  };
  const original = ["# comment", 'greeting: "Hello"', ""].join("\n");

  const file = await roundtrip(original, undefined, customSettings);
  expect(decode(file)).toBe(["greeting: Hello", ""].join("\n"));
});

test("preserves formatting for Rails-style files (locale root key)", async () => {
  const customSettings: ProjectSettings = {
    [PLUGIN_KEY]: {
      pathPattern: "./config/locales/{locale}.yml",
      variableReferencePattern: ["%{", "}"],
      localeAsRootKey: true,
    },
  };
  const original = [
    "en:",
    "  # greeting section",
    '  hello: "Hi %{user}!"',
    "  items:",
    "    one: One item",
    '    other: "%{count} items"',
    "",
  ].join("\n");

  const file = await roundtrip(original, undefined, customSettings);
  expect(decode(file)).toBe(original);
});

test("reports the file and locale on invalid YAML", async () => {
  await expect(
    importFiles({
      settings,
      files: [{ locale: "de", content: encode("a: [unclosed") }],
    }),
  ).rejects.toThrow(/locale file "de"/);
});
