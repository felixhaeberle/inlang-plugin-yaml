import { stringify } from "yaml";
import { PLUGIN_KEY } from "./pluginKey.js";
import type {
  LegacyMessage,
  LegacyPattern,
  NodeishFilesystemSubset,
  ProjectSettings,
} from "./types.js";
import type { PluginSettings } from "./settings.js";
import {
  assignPath,
  flattenYaml,
  parseYamlObject,
  replaceLocale,
} from "./utilities.js";
import {
  DEFAULT_VARIABLE_REFERENCE_PATTERN,
  parseLegacyPattern,
  serializeLegacyPattern,
} from "./pattern.js";

/**
 * Legacy plugin API (v4), still called by apps like Sherlock (the inlang
 * VS Code extension). New apps use importFiles/exportFiles instead.
 *
 * Note: the legacy API flattens nested YAML keys with a dot (`a.b`) on load
 * and re-nests them on save.
 */
export async function loadMessages(args: {
  settings: ProjectSettings;
  nodeishFs: NodeishFilesystemSubset;
}): Promise<LegacyMessage[]> {
  const pluginSettings = getPluginSettings(args.settings);
  const variableReferencePattern =
    pluginSettings.variableReferencePattern ??
    DEFAULT_VARIABLE_REFERENCE_PATTERN;
  const languageTags =
    args.settings.languageTags ?? args.settings.locales ?? [];
  const sourceLanguageTag =
    args.settings.sourceLanguageTag ?? args.settings.baseLocale;

  const messages: LegacyMessage[] = [];

  for (const languageTag of resolveOrderOfLanguageTags(
    languageTags,
    sourceLanguageTag,
  )) {
    if (typeof pluginSettings.pathPattern === "string") {
      const entries = await readYamlEntries({
        nodeishFs: args.nodeishFs,
        pathPattern: pluginSettings.pathPattern,
        languageTag,
        pluginSettings,
      });
      for (const { key, value } of entries) {
        addVariantToMessages(
          messages,
          key,
          languageTag,
          value,
          variableReferencePattern,
        );
      }
    } else {
      for (const [namespace, pathPattern] of Object.entries(
        pluginSettings.pathPattern,
      )) {
        const entries = await readYamlEntries({
          nodeishFs: args.nodeishFs,
          pathPattern,
          languageTag,
          pluginSettings,
        });
        for (const { key, value } of entries) {
          addVariantToMessages(
            messages,
            `${namespace}:${key}`,
            languageTag,
            value,
            variableReferencePattern,
          );
        }
      }
    }
  }

  return messages;
}

export async function saveMessages(args: {
  messages: LegacyMessage[];
  settings: ProjectSettings;
  nodeishFs: NodeishFilesystemSubset;
}): Promise<void> {
  const pluginSettings = getPluginSettings(args.settings);
  const variableReferencePattern =
    pluginSettings.variableReferencePattern ??
    DEFAULT_VARIABLE_REFERENCE_PATTERN;

  if (typeof pluginSettings.pathPattern === "string") {
    // languageTag -> key -> pattern
    const storage: Record<string, Record<string, LegacyPattern>> = {};
    for (const message of args.messages) {
      for (const variant of message.variants) {
        storage[variant.languageTag] ??= {};
        storage[variant.languageTag]![message.id] = variant.pattern;
      }
    }
    for (const [languageTag, keyedPatterns] of Object.entries(storage)) {
      await writeYamlFile({
        nodeishFs: args.nodeishFs,
        path: replaceLocale(pluginSettings.pathPattern, languageTag),
        languageTag,
        keyedPatterns,
        pluginSettings,
        variableReferencePattern,
      });
    }
  } else {
    const namespaces = Object.keys(pluginSettings.pathPattern);
    const defaultNamespace = namespaces[0] as string;
    // languageTag -> namespace -> key -> pattern
    const storage: Record<
      string,
      Record<string, Record<string, LegacyPattern>>
    > = {};
    for (const message of args.messages) {
      const namespace =
        namespaces.find((candidate) =>
          message.id.startsWith(`${candidate}:`),
        ) ?? defaultNamespace;
      const key = message.id.startsWith(`${namespace}:`)
        ? message.id.slice(namespace.length + 1)
        : message.id;
      for (const variant of message.variants) {
        storage[variant.languageTag] ??= {};
        storage[variant.languageTag]![namespace] ??= {};
        storage[variant.languageTag]![namespace]![key] = variant.pattern;
      }
    }
    for (const [languageTag, namespacedPatterns] of Object.entries(storage)) {
      for (const [namespace, keyedPatterns] of Object.entries(
        namespacedPatterns,
      )) {
        await writeYamlFile({
          nodeishFs: args.nodeishFs,
          path: replaceLocale(
            pluginSettings.pathPattern[namespace] as string,
            languageTag,
          ),
          languageTag,
          keyedPatterns,
          pluginSettings,
          variableReferencePattern,
        });
      }
    }
  }
}

function getPluginSettings(settings: ProjectSettings): PluginSettings {
  const pluginSettings = settings[PLUGIN_KEY] as PluginSettings | undefined;
  if (pluginSettings === undefined) {
    throw new Error(
      `The settings for "${PLUGIN_KEY}" are missing. Add them to your project settings.`,
    );
  }
  return pluginSettings;
}

/**
 * Moves the source language to the first spot so its messages define the
 * message order.
 */
function resolveOrderOfLanguageTags(
  languageTags: readonly string[],
  sourceLanguageTag: string | undefined,
): string[] {
  if (sourceLanguageTag === undefined) {
    return [...languageTags];
  }
  const filteredTags = languageTags.filter(
    (tag) => tag !== sourceLanguageTag,
  );
  return [sourceLanguageTag, ...filteredTags];
}

async function readYamlEntries(args: {
  nodeishFs: NodeishFilesystemSubset;
  pathPattern: string;
  languageTag: string;
  pluginSettings: PluginSettings;
}): Promise<Array<{ key: string; value: string }>> {
  const path = replaceLocale(args.pathPattern, args.languageTag);
  let file: string;
  try {
    file = await args.nodeishFs.readFile(path, { encoding: "utf-8" });
  } catch (error) {
    // file does not exist yet, e.g. a namespace file missing for one language
    if (
      (error as { code?: string }).code === "FileNotFound" ||
      (error as { code?: string }).code === "ENOENT"
    ) {
      return [];
    }
    throw error;
  }

  let root = parseYamlObject(file);
  if (args.pluginSettings.localeAsRootKey) {
    const unwrapped = root[args.languageTag];
    root =
      typeof unwrapped === "object" &&
      unwrapped !== null &&
      Array.isArray(unwrapped) === false
        ? (unwrapped as Record<string, unknown>)
        : {};
  }

  return flattenYaml(root);
}

function addVariantToMessages(
  messages: LegacyMessage[],
  key: string,
  languageTag: string,
  value: string,
  variableReferencePattern: string[],
) {
  const variant = {
    languageTag,
    match: [],
    pattern: parseLegacyPattern(value, variableReferencePattern),
  };
  const existingMessage = messages.find((message) => message.id === key);
  if (existingMessage !== undefined) {
    existingMessage.variants.push(variant);
  } else {
    messages.push({
      id: key,
      alias: {},
      selectors: [],
      variants: [variant],
    });
  }
}

async function writeYamlFile(args: {
  nodeishFs: NodeishFilesystemSubset;
  path: string;
  languageTag: string;
  keyedPatterns: Record<string, LegacyPattern>;
  pluginSettings: PluginSettings;
  variableReferencePattern: string[];
}): Promise<void> {
  const tree: Record<string, unknown> = {};
  for (const [key, pattern] of Object.entries(args.keyedPatterns)) {
    assignPath(
      tree,
      key.split("."),
      serializeLegacyPattern(pattern, args.variableReferencePattern),
    );
  }
  const root = args.pluginSettings.localeAsRootKey
    ? { [args.languageTag]: tree }
    : tree;

  const directoryPath = args.path.split("/").slice(0, -1).join("/");
  if (directoryPath !== "" && directoryPath !== ".") {
    try {
      await args.nodeishFs.mkdir(directoryPath, { recursive: true });
    } catch {
      // directory already exists
    }
  }

  await args.nodeishFs.writeFile(
    args.path,
    stringify(root, { indent: 2, lineWidth: 0 }),
  );
}
