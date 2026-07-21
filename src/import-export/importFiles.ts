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
import { flattenYaml, parseYamlObject } from "../utilities.js";
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

  const bundles = new Map<string, BundleImport>();
  const messages: MessageImport[] = [];
  const variants: VariantImport[] = [];

  for (const file of args.files) {
    const namespace = file.toBeImportedFilesMetadata?.namespace as
      | string
      | undefined;
    let root = parseYamlObject(new TextDecoder().decode(file.content));

    if (pluginSettings?.localeAsRootKey) {
      const unwrapped = root[file.locale];
      root =
        typeof unwrapped === "object" &&
        unwrapped !== null &&
        Array.isArray(unwrapped) === false
          ? (unwrapped as Record<string, unknown>)
          : {};
    }

    for (const { key, path, value } of flattenYaml(root)) {
      const bundleId = namespace ? `${namespace}:${key}` : key;
      const pattern = parsePattern(value, variableReferencePattern);
      const declarations = uniqueDeclarations(
        pattern.filter(isVariableReferenceExpression).map((part) => ({
          type: "input-variable" as const,
          name: part.arg.name,
        })),
      );

      const existingBundle = bundles.get(bundleId);
      if (existingBundle === undefined) {
        bundles.set(bundleId, { id: bundleId, declarations });
      } else {
        existingBundle.declarations = uniqueDeclarations([
          ...existingBundle.declarations,
          ...declarations,
        ]);
      }

      const messageId = createMessageId({
        locale: file.locale,
        bundleId,
        path,
      });

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
    }
  }

  return {
    bundles: Array.from(bundles.values()),
    messages,
    variants,
  };
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
