import { expect, test } from "vitest";
import { parse } from "yaml";
import { loadMessages, saveMessages } from "./legacy.js";
import { PLUGIN_KEY } from "./pluginKey.js";
import type { NodeishFilesystemSubset } from "./types.js";

function createMockFs(initialFiles: Record<string, string> = {}) {
  const files = new Map<string, string>();
  for (const [path, content] of Object.entries(initialFiles)) {
    files.set(normalize(path), content);
  }
  const fs: NodeishFilesystemSubset = {
    async readFile(path: string, _options: { encoding: "utf-8" }) {
      const content = files.get(normalize(path));
      if (content === undefined) {
        const error = new Error(`ENOENT: no such file: ${path}`) as Error & {
          code: string;
        };
        error.code = "ENOENT";
        throw error;
      }
      return content;
    },
    async readdir() {
      return [];
    },
    async writeFile(path: string, data: string) {
      files.set(normalize(path), data);
    },
    async mkdir() {
      return undefined;
    },
  };
  return { fs, files };
}

function normalize(path: string): string {
  return path.replace(/^\.\//, "");
}

test("loads nested YAML files into legacy messages, source language first", async () => {
  const { fs } = createMockFs({
    "./messages/en.yaml": "greeting: Hello {name}\nnested:\n  bye: Bye\n",
    "./messages/de.yaml": "greeting: Hallo {name}\nnested:\n  bye: Tschüss\n",
  });

  const messages = await loadMessages({
    settings: {
      sourceLanguageTag: "en",
      languageTags: ["de", "en"],
      [PLUGIN_KEY]: { pathPattern: "./messages/{languageTag}.yaml" },
    },
    nodeishFs: fs,
  });

  expect(messages.map((message) => message.id)).toEqual([
    "greeting",
    "nested.bye",
  ]);
  const greeting = messages[0]!;
  // source language variant comes first
  expect(greeting.variants.map((variant) => variant.languageTag)).toEqual([
    "en",
    "de",
  ]);
  expect(greeting.variants[0]?.pattern).toEqual([
    { type: "Text", value: "Hello " },
    { type: "VariableReference", name: "name" },
  ]);
});

test("ignores missing files and works with v2 locale settings", async () => {
  const { fs } = createMockFs({
    "./messages/en.yaml": "greeting: Hello\n",
  });

  const messages = await loadMessages({
    settings: {
      baseLocale: "en",
      locales: ["en", "fr"],
      [PLUGIN_KEY]: { pathPattern: "./messages/{locale}.yaml" },
    },
    nodeishFs: fs,
  });

  expect(messages).toHaveLength(1);
  expect(messages[0]?.variants).toHaveLength(1);
});

test("saves legacy messages back to nested YAML", async () => {
  const { fs, files } = createMockFs({
    "./messages/en.yaml": "greeting: Hello {name}\nnested:\n  bye: Bye\n",
    "./messages/de.yaml": "greeting: Hallo {name}\nnested:\n  bye: Tschüss\n",
  });
  const settings = {
    sourceLanguageTag: "en",
    languageTags: ["en", "de"],
    [PLUGIN_KEY]: { pathPattern: "./messages/{languageTag}.yaml" },
  };

  const messages = await loadMessages({ settings, nodeishFs: fs });
  await saveMessages({ messages, settings, nodeishFs: fs });

  expect(parse(files.get("messages/en.yaml")!)).toEqual({
    greeting: "Hello {name}",
    nested: { bye: "Bye" },
  });
  expect(parse(files.get("messages/de.yaml")!)).toEqual({
    greeting: "Hallo {name}",
    nested: { bye: "Tschüss" },
  });
});

test("creates files for newly added languages", async () => {
  const { fs, files } = createMockFs();
  await saveMessages({
    settings: {
      sourceLanguageTag: "en",
      languageTags: ["en", "fr"],
      [PLUGIN_KEY]: { pathPattern: "./locales/{languageTag}.yml" },
    },
    nodeishFs: fs,
    messages: [
      {
        id: "greeting",
        alias: {},
        selectors: [],
        variants: [
          {
            languageTag: "fr",
            match: [],
            pattern: [{ type: "Text", value: "Bonjour" }],
          },
        ],
      },
    ],
  });

  expect(parse(files.get("locales/fr.yml")!)).toEqual({ greeting: "Bonjour" });
});

test("round-trips namespaced path patterns", async () => {
  const { fs, files } = createMockFs({
    "./messages/en/common.yaml": "title: Welcome\n",
    "./messages/en/auth.yaml": "signIn: Sign in\n",
  });
  const settings = {
    sourceLanguageTag: "en",
    languageTags: ["en"],
    [PLUGIN_KEY]: {
      pathPattern: {
        common: "./messages/{languageTag}/common.yaml",
        auth: "./messages/{languageTag}/auth.yaml",
      },
    },
  };

  const messages = await loadMessages({ settings, nodeishFs: fs });
  expect(messages.map((message) => message.id)).toEqual([
    "common:title",
    "auth:signIn",
  ]);

  await saveMessages({ messages, settings, nodeishFs: fs });
  expect(parse(files.get("messages/en/common.yaml")!)).toEqual({
    title: "Welcome",
  });
  expect(parse(files.get("messages/en/auth.yaml")!)).toEqual({
    signIn: "Sign in",
  });
});

test("round-trips Rails-style files (locale as root key, %{} variables)", async () => {
  const railsEn = ["en:", '  hello: "Hi %{user}!"', "  bye: Bye"].join("\n");
  const { fs, files } = createMockFs({
    "./config/locales/en.yml": railsEn,
  });
  const settings = {
    sourceLanguageTag: "en",
    languageTags: ["en"],
    [PLUGIN_KEY]: {
      pathPattern: "./config/locales/{languageTag}.yml",
      variableReferencePattern: ["%{", "}"],
      localeAsRootKey: true,
    },
  };

  const messages = await loadMessages({ settings, nodeishFs: fs });
  expect(messages.map((message) => message.id)).toEqual(["hello", "bye"]);
  expect(messages[0]?.variants[0]?.pattern).toEqual([
    { type: "Text", value: "Hi " },
    { type: "VariableReference", name: "user" },
    { type: "Text", value: "!" },
  ]);

  await saveMessages({ messages, settings, nodeishFs: fs });
  expect(parse(files.get("config/locales/en.yml")!)).toEqual({
    en: { hello: "Hi %{user}!", bye: "Bye" },
  });
});
