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
  DEFAULT_VARIABLE_REFERENCE_PATTERN,
  serializePattern,
} from "../pattern.js";

type ExportMessage = {
  key: string;
  path?: string[];
  value: string;
};

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

  const namespaces =
    pathPattern !== undefined &&
    pathPattern !== null &&
    typeof pathPattern === "object"
      ? Object.keys(pathPattern)
      : [];
  const defaultNamespace = namespaces[0];

  const files: Record<string, ExportMessage[]> = {};
  const namespaceFiles: Record<string, Record<string, ExportMessage[]>> = {};

  for (const message of args.messages) {
    const bundle = args.bundles.find(
      (candidate) => candidate.id === message.bundleId,
    );
    if (bundle === undefined) {
      continue;
    }

    const messageVariants = args.variants.filter(
      (candidate) => candidate.messageId === message.id,
    );
    if (
      message.selectors.length > 0 ||
      messageVariants.length > 1 ||
      messageVariants.some((variant) => variant.matches.length > 0)
    ) {
      throw new Error(
        "Selectors, matches, and multiple variants are not supported by the YAML plugin.",
      );
    }

    const namespace =
      resolveNamespaceFromBundleId(bundle.id, namespaces) ?? defaultNamespace;
    const key = namespace
      ? removeNamespaceFromBundleId(bundle.id, namespace)
      : bundle.id;
    const path = getCurrentMessagePath({
      messageId: message.id,
      currentKey: key,
    });

    for (const variant of messageVariants) {
      const exportMessage = {
        key,
        path,
        value: serializePattern(variant.pattern, variableReferencePattern),
      };

      if (namespace === undefined) {
        files[message.locale] ??= [];
        files[message.locale]!.push(exportMessage);
      } else {
        namespaceFiles[namespace] ??= {};
        namespaceFiles[namespace]![message.locale] ??= [];
        namespaceFiles[namespace]![message.locale]!.push(exportMessage);
      }
    }
  }

  const withoutNamespaces: ExportFile[] = Object.entries(files).map(
    ([locale, messages]) => ({
      locale,
      content: encodeYaml(messages, { locale, localeAsRootKey }),
      name: `${locale}.${resolveExtension(
        typeof pathPattern === "string" ? pathPattern : undefined,
      )}`,
    }),
  );
  const withNamespaces: ExportFile[] = Object.entries(namespaceFiles).flatMap(
    ([namespace, locales]) =>
      Object.entries(locales).map(([locale, messages]) => ({
        locale,
        content: encodeYaml(messages, { locale, localeAsRootKey }),
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

function encodeYaml(
  messages: ExportMessage[],
  options: { locale: string; localeAsRootKey: boolean },
): Uint8Array {
  const tree = toTree(messages);
  const root = options.localeAsRootKey ? { [options.locale]: tree } : tree;
  return new TextEncoder().encode(
    stringify(root, { indent: 2, lineWidth: 0 }),
  );
}

function toTree(messages: ExportMessage[]): Record<string, unknown> {
  const flatMessages: Record<string, string> = {};
  const result: Record<string, unknown> = {};

  for (const message of messages) {
    if (message.path === undefined) {
      flatMessages[message.key] = message.value;
      continue;
    }
    assignPath(result, message.path, message.value);
  }

  return { ...flatMessages, ...result };
}
