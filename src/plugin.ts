import type { TObject } from "@sinclair/typebox";
import { PLUGIN_KEY } from "./pluginKey.js";
import { PluginSettings } from "./settings.js";
import { toBeImportedFiles } from "./import-export/toBeImportedFiles.js";
import { importFiles } from "./import-export/importFiles.js";
import { exportFiles } from "./import-export/exportFiles.js";
import { loadMessages, saveMessages } from "./legacy.js";

/**
 * The YAML resource plugin for inlang.
 *
 * Implements the current resource-plugin API (`toBeImportedFiles`,
 * `importFiles`, `exportFiles`) and retains the legacy `loadMessages`/
 * `saveMessages` callbacks for older consumers like Sherlock.
 */
export const plugin = {
  id: PLUGIN_KEY,
  key: PLUGIN_KEY,
  displayName: "YAML",
  description:
    "Use YAML files (.yaml/.yml) as translation resources in inlang.",
  settingsSchema: PluginSettings as unknown as TObject,
  toBeImportedFiles,
  importFiles,
  exportFiles,
  loadMessages,
  saveMessages,
};
