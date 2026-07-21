import type { TObject } from "@sinclair/typebox";
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
export declare const plugin: {
    id: string;
    key: string;
    displayName: string;
    description: string;
    settingsSchema: TObject;
    toBeImportedFiles: typeof toBeImportedFiles;
    importFiles: typeof importFiles;
    exportFiles: typeof exportFiles;
    loadMessages: typeof loadMessages;
    saveMessages: typeof saveMessages;
};
