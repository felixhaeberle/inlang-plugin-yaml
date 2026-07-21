import { stringify } from "yaml";
import type {
  Bundle,
  ExportFile,
  Message,
  ProjectSettings,
  Variant,
} from "../types.js";
import type { PluginSettings } from "../settings.js";
import { PLUGIN_KEY } from "../pluginKey.js";
import { getMessagePath } from "./messageId.js";
import { assignPath, resolveExtension } from "../utilities.js";
import {
  deleteAndPrune,
  setValueAtPath,
  stringifyDocument,
} from "../yamlDocument.js";
import { cacheKey, encodeLeafPath, getFileFormat } from "../formatCache.js";
import {
  categoryFromMatches,
  sortCategories,
  type PluralCategory,
} from "../plurals.js";
import {
  DEFAULT_VARIABLE_REFERENCE_PATTERN,
  serializePattern,
} from "../pattern.js";

/** A single scalar to write, addressed by its full path in the document. */
type ExportLeaf = { docPath: string[]; value: string };

export async function exportFiles(args: {
  bundles: Bundle[];
  messages: Message[];
  variants: Variant[];
  settings: ProjectSettings;
}): Promise<ExportFile[]> {
  const pluginSettings = args.settings[PLUGIN_KEY] as
    | PluginSettings
    | undefined;
  const pathPattern = pluginSettings?.pathPattern;
  const variableReferencePattern =
    pluginSettings?.variableReferencePattern ??
    DEFAULT_VARIABLE_REFERENCE_PATTERN;
  const localeAsRootKey = pluginSettings?.localeAsRootKey ?? false;
  const preserveFormatting = pluginSettings?.preserveFormatting ?? true;

  const namespaces =
    pathPattern !== undefined &&
    pathPattern !== null &&
    typeof pathPattern === "object"
      ? Object.keys(pathPattern)
      : [];
  const defaultNamespace = namespaces[0];

  const bundlesById = new Map(args.bundles.map((bundle) => [bundle.id, bundle]));
  const variantsByMessageId = new Map<string, Variant[]>();
  for (const variant of args.variants) {
    const list = variantsByMessageId.get(variant.messageId);
    if (list === undefined) {
      variantsByMessageId.set(variant.messageId, [variant]);
    } else {
      list.push(variant);
    }
  }

  // locale -> leaves (files without namespaces) / namespace -> locale -> leaves
  const files: Record<string, ExportLeaf[]> = {};
  const namespaceFiles: Record<string, Record<string, ExportLeaf[]>> = {};

  for (const message of args.messages) {
    const bundle = bundlesById.get(message.bundleId);
    if (bundle === undefined) {
      continue;
    }
    const messageVariants = variantsByMessageId.get(message.id) ?? [];
    if (messageVariants.length === 0) {
      continue;
    }

    const namespace =
      resolveNamespaceFromBundleId(bundle.id, namespaces) ?? defaultNamespace;
    const key = namespace
      ? removeNamespaceFromBundleId(bundle.id, namespace)
      : bundle.id;
    const basePath = getCurrentMessagePath({
      messageId: message.id,
      currentKey: key,
    }) ?? [key];
    const docPathPrefix = localeAsRootKey ? [message.locale] : [];

    const leaves = messageToLeaves({
      message,
      messageVariants,
      basePath: [...docPathPrefix, ...basePath],
      bundleId: bundle.id,
      variableReferencePattern,
    });

    if (namespace === undefined) {
      files[message.locale] ??= [];
      files[message.locale]!.push(...leaves);
    } else {
      namespaceFiles[namespace] ??= {};
      namespaceFiles[namespace]![message.locale] ??= [];
      namespaceFiles[namespace]![message.locale]!.push(...leaves);
    }
  }

  const withoutNamespaces: ExportFile[] = Object.entries(files).map(
    ([locale, leaves]) => ({
      locale,
      content: encodeYaml({
        leaves,
        cacheKey: cacheKey({
          settings: pluginSettings,
          locale,
          namespace: undefined,
        }),
        preserveFormatting,
      }),
      name: `${locale}.${resolveExtension(
        typeof pathPattern === "string" ? pathPattern : undefined,
      )}`,
    }),
  );
  const withNamespaces: ExportFile[] = Object.entries(namespaceFiles).flatMap(
    ([namespace, locales]) =>
      Object.entries(locales).map(([locale, leaves]) => ({
        locale,
        content: encodeYaml({
          leaves,
          cacheKey: cacheKey({ settings: pluginSettings, locale, namespace }),
          preserveFormatting,
        }),
        name: `${namespace}-${locale}.${resolveExtension(
          typeof pathPattern === "object" && pathPattern !== null
            ? pathPattern[namespace]
            : undefined,
        )}`,
        metadata: { namespace },
      })),
  );

  return [...withoutNamespaces, ...withNamespaces];
}

/**
 * Converts one message (and its variants) into scalar leaves.
 *
 * - A single variant without selectors/matches -> one leaf at the base path.
 * - Plural variants (single selector, category matches) -> one leaf per
 *   category below the base path.
 */
function messageToLeaves(args: {
  message: Message;
  messageVariants: Variant[];
  basePath: string[];
  bundleId: string;
  variableReferencePattern: string[];
}): ExportLeaf[] {
  const { message, messageVariants } = args;

  if (
    message.selectors.length === 0 &&
    messageVariants.length === 1 &&
    messageVariants[0]!.matches.length === 0
  ) {
    return [
      {
        docPath: args.basePath,
        value: serializePattern(
          messageVariants[0]!.pattern,
          args.variableReferencePattern,
        ),
      },
    ];
  }

  if (message.selectors.length === 1) {
    const categories: Partial<Record<PluralCategory, string>> = {};
    let isPlural = true;
    for (const variant of messageVariants) {
      const category = categoryFromMatches(variant.matches);
      if (category === undefined || categories[category] !== undefined) {
        isPlural = false;
        break;
      }
      categories[category] = serializePattern(
        variant.pattern,
        args.variableReferencePattern,
      );
    }
    if (isPlural) {
      return sortCategories(categories).map(([category, value]) => ({
        docPath: [...args.basePath, category],
        value,
      }));
    }
  }

  throw new Error(
    `Message "${args.bundleId}" (${message.locale}) cannot be represented in YAML: ` +
      "only plain messages and plural variants (CLDR categories with a single selector) are supported.",
  );
}

function resolveNamespaceFromBundleId(
  bundleId: string,
  namespaces: string[],
): string | undefined {
  return [...namespaces]
    .sort((left, right) => right.length - left.length)
    .find((namespace) => bundleId.startsWith(`${namespace}:`));
}

function removeNamespaceFromBundleId(
  bundleId: string,
  namespace: string,
): string {
  return bundleId.startsWith(`${namespace}:`)
    ? bundleId.slice(namespace.length + 1)
    : bundleId;
}

function getCurrentMessagePath(args: {
  messageId: string;
  currentKey: string;
}): string[] | undefined {
  const path = getMessagePath(args.messageId);
  return path?.join(".") === args.currentKey ? path : undefined;
}

function encodeYaml(args: {
  leaves: ExportLeaf[];
  cacheKey: string;
  preserveFormatting: boolean;
}): Uint8Array {
  const cached = args.preserveFormatting
    ? getFileFormat(args.cacheKey)
    : undefined;

  if (cached === undefined) {
    // no existing file known -> emit a clean tree
    const tree: Record<string, unknown> = {};
    for (const leaf of args.leaves) {
      assignPath(tree, leaf.docPath, leaf.value);
    }
    return new TextEncoder().encode(
      stringify(tree, { indent: 2, lineWidth: 0 }),
    );
  }

  // update the imported document in place: comments, key order, quote
  // styles, and non-message content (arrays, etc.) survive
  const currentLeafPaths = new Set(
    args.leaves.map((leaf) => encodeLeafPath(leaf.docPath)),
  );
  for (const staleLeafPath of cached.importedLeafPaths) {
    if (currentLeafPaths.has(staleLeafPath) === false) {
      deleteAndPrune(cached.document, JSON.parse(staleLeafPath));
    }
  }
  for (const leaf of args.leaves) {
    setValueAtPath(cached.document, leaf.docPath, leaf.value);
  }
  // future exports must treat everything just written as message content
  cached.importedLeafPaths = currentLeafPaths;

  return new TextEncoder().encode(
    stringifyDocument(cached.document, cached.indent),
  );
}
