import type { ProjectSettings } from "../types.js";
import type { PluginSettings } from "../settings.js";
import { PLUGIN_KEY } from "../pluginKey.js";
import { replaceLocale } from "../utilities.js";

export async function toBeImportedFiles(args: {
  settings: ProjectSettings;
}): Promise<
  Array<{ locale: string; path: string; metadata?: Record<string, unknown> }>
> {
  const result: Array<{
    locale: string;
    path: string;
    metadata?: Record<string, unknown>;
  }> = [];
  const pluginSettings = args.settings[PLUGIN_KEY] as
    | PluginSettings
    | undefined;
  const pathPattern = pluginSettings?.pathPattern;
  const locales = args.settings.locales ?? args.settings.languageTags ?? [];

  if (pathPattern === undefined || pathPattern === null) {
    return result;
  }

  if (typeof pathPattern === "string") {
    for (const locale of locales) {
      result.push({
        locale,
        path: replaceLocale(pathPattern, locale),
      });
    }
    return result;
  }

  for (const locale of locales) {
    for (const [namespace, pattern] of Object.entries(pathPattern)) {
      result.push({
        locale,
        path: replaceLocale(pattern, locale),
        metadata: { namespace },
      });
    }
  }

  return result;
}
