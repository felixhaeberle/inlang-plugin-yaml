import { stringify } from "yaml";
import { PLUGIN_KEY } from "./pluginKey.js";
import type {
  LegacyMessage,
  LegacyPattern,
  NodeishFilesystemSubset,
  ProjectSettings,
} from "./types.js";
import type { PluginSettings } from "./settings.js";
import { assignPath, collectEntries, replaceLocale } from "./utilities.js";
import {
  deleteAndPrune,
  detectIndent,
  parseYamlDocument,
  setValueAtPath,
  stringifyDocument,
  toPlainObject,
} from "./yamlDocument.js";
import { cacheKey } from "./formatCache.js";
import {
  DEFAULT_VARIABLE_REFERENCE_PATTERN,
  parseLegacyPattern,
  serializeLegacyPattern,
} from "./pattern.js";

/**
 * Message IDs loaded per file, so a later save can remove messages that were
 * deleted in the app. Module-level for the same reason as the format cache:
 * the legacy API has no other channel between load and save.
 */
const loadedMessageIds = new Map<string, Set<string>>();

/**
 * Legacy plugin API (v4), still called by apps like Sherlock (the inlang
 * VS Code extension). New apps use importFiles/exportFiles instead.
 *
 * Notes:
 * - nested YAML keys are flattened with a dot (`a.b`) on load and re-nested
 *   on save
 * - plural groups are exposed as flat `key.one`/`key.other` messages (the
 *   modern API models them as real plural variants)
 * - saving updates existing files in place, preserving comments, key order,
 *   quote styles, indentation, and non-message content
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
    for (const [namespace, pathPattern] of resolvePathPatterns(
      pluginSettings,
    )) {
      const entries = await readYamlEntries({
        nodeishFs: args.nodeishFs,
        pathPattern,
        languageTag,
        pluginSettings,
      });
      const fileMessageIds = new Set<string>();
      for (const { key, value } of entries) {
        const messageId = namespace ? `${namespace}:${key}` : key;
        fileMessageIds.add(messageId);
        addVariantToMessages(
          messages,
          messageId,
          languageTag,
          value,
          variableReferencePattern,
        );
      }
      loadedMessageIds.set(
        cacheKey({
          settings: pluginSettings,
          locale: languageTag,
          namespace,
        }),
        fileMessageIds,
      );
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
  const pathPatterns = resolvePathPatterns(pluginSettings);
  const namespaces = pathPatterns
    .map(([namespace]) => namespace)
    .filter((namespace): namespace is string => namespace !== undefined);
  const defaultNamespace = namespaces[0];

  // languageTag -> namespace ?? "" -> message id (without prefix) -> pattern
  const storage: Record<
    string,
    Record<string, Record<string, LegacyPattern>>
  > = {};
  for (const message of args.messages) {
    let namespace: string | undefined;
    let key = message.id;
    if (namespaces.length > 0) {
      namespace =
        namespaces.find((candidate) =>
          message.id.startsWith(`${candidate}:`),
        ) ?? defaultNamespace;
      key = message.id.startsWith(`${namespace}:`)
        ? message.id.slice(namespace!.length + 1)
        : message.id;
    }
    for (const variant of message.variants) {
      storage[variant.languageTag] ??= {};
      storage[variant.languageTag]![namespace ?? ""] ??= {};
      storage[variant.languageTag]![namespace ?? ""]![key] = variant.pattern;
    }
  }

  for (const [languageTag, namespacedPatterns] of Object.entries(storage)) {
    for (const [namespaceKey, keyedPatterns] of Object.entries(
      namespacedPatterns,
    )) {
      const namespace = namespaceKey === "" ? undefined : namespaceKey;
      const pathPattern = pathPatterns.find(
        ([candidate]) => candidate === namespace,
      )?.[1];
      if (pathPattern === undefined) {
        continue;
      }
      await writeYamlFile({
        nodeishFs: args.nodeishFs,
        path: replaceLocale(pathPattern, languageTag),
        languageTag,
        namespace,
        keyedPatterns,
        pluginSettings,
        variableReferencePattern,
      });
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
 * Normalizes the pathPattern setting into [namespace, pattern] tuples
 * (namespace undefined for a plain string pattern).
 */
function resolvePathPatterns(
  pluginSettings: PluginSettings,
): Array<[string | undefined, string]> {
  if (typeof pluginSettings.pathPattern === "string") {
    return [[undefined, pluginSettings.pathPattern]];
  }
  return Object.entries(pluginSettings.pathPattern);
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
  const file = await readFileIfExists(args.nodeishFs, path);
  if (file === undefined) {
    // file does not exist yet, e.g. a namespace file missing for one language
    return [];
  }

  const document = parseYamlDocument(file, `"${path}"`);
  let root = toPlainObject(document, `"${path}"`);
  if (args.pluginSettings.localeAsRootKey) {
    const unwrapped = root[args.languageTag];
    root =
      typeof unwrapped === "object" &&
      unwrapped !== null &&
      Array.isArray(unwrapped) === false
        ? (unwrapped as Record<string, unknown>)
        : {};
  }

  // the legacy message model has no plural variants -> flat entries
  return collectEntries(root, { plurals: false }).map((entry) => ({
    key: entry.key,
    value: entry.kind === "message" ? entry.value : "",
  }));
}

async function readFileIfExists(
  nodeishFs: NodeishFilesystemSubset,
  path: string,
): Promise<string | undefined> {
  try {
    return await nodeishFs.readFile(path, { encoding: "utf-8" });
  } catch (error) {
    if (
      (error as { code?: string }).code === "FileNotFound" ||
      (error as { code?: string }).code === "ENOENT"
    ) {
      return undefined;
    }
    throw error;
  }
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
  namespace: string | undefined;
  keyedPatterns: Record<string, LegacyPattern>;
  pluginSettings: PluginSettings;
  variableReferencePattern: string[];
}): Promise<void> {
  const prefix = args.pluginSettings.localeAsRootKey
    ? [args.languageTag]
    : [];
  const existing = await readFileIfExists(args.nodeishFs, args.path);

  let content: string;
  if (existing === undefined) {
    // no existing file -> emit a clean tree
    const tree: Record<string, unknown> = {};
    for (const [key, pattern] of Object.entries(args.keyedPatterns)) {
      assignPath(
        tree,
        [...prefix, ...key.split(".")],
        serializeLegacyPattern(pattern, args.variableReferencePattern),
      );
    }
    content = stringify(tree, { indent: 2, lineWidth: 0 });
  } else {
    // update the existing file in place: comments, key order, quote styles,
    // and non-message content survive
    const document = parseYamlDocument(existing, `"${args.path}"`);
    const previousIds = loadedMessageIds.get(
      cacheKey({
        settings: args.pluginSettings,
        locale: args.languageTag,
        namespace: args.namespace,
      }),
    );
    if (previousIds !== undefined) {
      for (const previousId of previousIds) {
        if (previousId in args.keyedPatterns === false) {
          const unprefixedId =
            args.namespace !== undefined &&
            previousId.startsWith(`${args.namespace}:`)
              ? previousId.slice(args.namespace.length + 1)
              : previousId;
          if (unprefixedId in args.keyedPatterns === false) {
            deleteAndPrune(document, [...prefix, ...unprefixedId.split(".")]);
          }
        }
      }
    }
    for (const [key, pattern] of Object.entries(args.keyedPatterns)) {
      setValueAtPath(
        document,
        [...prefix, ...key.split(".")],
        serializeLegacyPattern(pattern, args.variableReferencePattern),
      );
    }
    content = stringifyDocument(document, detectIndent(existing));
  }

  const directoryPath = args.path.split("/").slice(0, -1).join("/");
  if (directoryPath !== "" && directoryPath !== ".") {
    try {
      await args.nodeishFs.mkdir(directoryPath, { recursive: true });
    } catch {
      // directory already exists
    }
  }

  await args.nodeishFs.writeFile(args.path, content);
}
