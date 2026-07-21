import type {
  BundleImport,
  Declaration,
  Expression,
  ImportFile,
  MessageImport,
  Pattern,
  ProjectSettings,
  VariantImport,
} from "../types.js";
import type { PluginSettings } from "../settings.js";
import { PLUGIN_KEY } from "../pluginKey.js";
import { createMessageId, createVariantId } from "./messageId.js";
import { collectEntries } from "../utilities.js";
import {
  detectIndent,
  parseYamlDocument,
  toPlainObject,
} from "../yamlDocument.js";
import {
  cacheKey,
  encodeLeafPath,
  setFileFormat,
} from "../formatCache.js";
import {
  matchesForCategory,
  pluralDeclarations,
  pluralSelectors,
  sortCategories,
} from "../plurals.js";
import {
  DEFAULT_VARIABLE_REFERENCE_PATTERN,
  parsePattern,
} from "../pattern.js";

type VariableReferenceExpression = Expression & {
  arg: { type: "variable-reference"; name: string };
};

export async function importFiles(args: {
  files: ImportFile[];
  settings: ProjectSettings;
}): Promise<{
  bundles: BundleImport[];
  messages: MessageImport[];
  variants: VariantImport[];
}> {
  const pluginSettings = args.settings[PLUGIN_KEY] as
    | PluginSettings
    | undefined;
  const variableReferencePattern =
    pluginSettings?.variableReferencePattern ??
    DEFAULT_VARIABLE_REFERENCE_PATTERN;
  const pluralsEnabled = pluginSettings?.plurals ?? true;
  const preserveFormatting = pluginSettings?.preserveFormatting ?? true;

  const bundles = new Map<string, BundleImport>();
  const messages: MessageImport[] = [];
  const variants: VariantImport[] = [];

  for (const file of args.files) {
    const namespace = file.toBeImportedFilesMetadata?.namespace as
      | string
      | undefined;
    const context =
      namespace === undefined
        ? `locale file "${file.locale}"`
        : `locale file "${file.locale}" (namespace "${namespace}")`;

    const text = new TextDecoder().decode(file.content);
    const document = parseYamlDocument(text, context);
    let root = toPlainObject(document, context);

    const docPathPrefix: string[] = [];
    if (pluginSettings?.localeAsRootKey) {
      docPathPrefix.push(file.locale);
      const unwrapped = root[file.locale];
      root =
        typeof unwrapped === "object" &&
        unwrapped !== null &&
        Array.isArray(unwrapped) === false
          ? (unwrapped as Record<string, unknown>)
          : {};
    }

    const importedLeafPaths = new Set<string>();

    for (const entry of collectEntries(root, { plurals: pluralsEnabled })) {
      const bundleId = namespace ? `${namespace}:${entry.key}` : entry.key;
      const messageId = createMessageId({
        locale: file.locale,
        bundleId,
        path: entry.path,
      });

      if (entry.kind === "message") {
        importedLeafPaths.add(
          encodeLeafPath([...docPathPrefix, ...entry.path]),
        );
        const pattern = parsePattern(entry.value, variableReferencePattern);
        upsertBundle(bundles, bundleId, patternDeclarations(pattern));
        messages.push({
          id: messageId,
          bundleId,
          locale: file.locale,
          selectors: [],
        });
        variants.push({
          id: createVariantId(messageId),
          messageId,
          matches: [],
          pattern,
        });
        continue;
      }

      // plural group -> one message with a variant per category
      const declarations: Declaration[] = [...pluralDeclarations()];
      messages.push({
        id: messageId,
        bundleId,
        locale: file.locale,
        selectors: pluralSelectors(),
      });
      for (const [category, value] of sortCategories(entry.categories)) {
        importedLeafPaths.add(
          encodeLeafPath([...docPathPrefix, ...entry.path, category]),
        );
        const pattern = parsePattern(value, variableReferencePattern);
        declarations.push(...patternDeclarations(pattern));
        variants.push({
          id: createVariantId(messageId, category),
          messageId,
          matches: matchesForCategory(category),
          pattern,
        });
      }
      upsertBundle(bundles, bundleId, uniqueDeclarations(declarations));
    }

    if (preserveFormatting) {
      setFileFormat(
        cacheKey({
          settings: pluginSettings,
          locale: file.locale,
          namespace,
        }),
        { document, importedLeafPaths, indent: detectIndent(text) },
      );
    }
  }

  return {
    bundles: Array.from(bundles.values()),
    messages,
    variants,
  };
}

function upsertBundle(
  bundles: Map<string, BundleImport>,
  bundleId: string,
  declarations: Declaration[],
) {
  const existingBundle = bundles.get(bundleId);
  if (existingBundle === undefined) {
    bundles.set(bundleId, { id: bundleId, declarations });
  } else {
    existingBundle.declarations = uniqueDeclarations([
      ...existingBundle.declarations,
      ...declarations,
    ]);
  }
}

function patternDeclarations(pattern: Pattern): Declaration[] {
  return uniqueDeclarations(
    pattern.filter(isVariableReferenceExpression).map((part) => ({
      type: "input-variable" as const,
      name: part.arg.name,
    })),
  );
}

function isVariableReferenceExpression(
  part: Pattern[number],
): part is VariableReferenceExpression {
  return part.type === "expression" && part.arg.type === "variable-reference";
}

function uniqueDeclarations(declarations: Declaration[]): Declaration[] {
  const result = new Map<string, Declaration>();
  for (const declaration of declarations) {
    result.set(`${declaration.type}:${declaration.name}`, declaration);
  }
  return Array.from(result.values());
}
