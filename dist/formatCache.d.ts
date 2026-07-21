import type { Document } from "yaml";
/**
 * Per-file formatting state captured during import and reused during export
 * so that comments, key order, quote styles, indentation, and non-message
 * content survive a round-trip.
 *
 * The cache is module-level because the plugin API gives `exportFiles` no
 * access to the current file content. The key includes the serialized plugin
 * settings, so distinct projects only collide when they share the exact same
 * configuration in one process (the same trade-off the official JSON plugin
 * makes with its global formatting state). Values are only ever a formatting
 * template — message values always come from the export arguments.
 */
export type FileFormat = {
    document: Document;
    /** Leaf paths (JSON-encoded string[]) that were imported as messages. */
    importedLeafPaths: Set<string>;
    indent: number;
};
export declare function cacheKey(args: {
    settings: unknown;
    locale: string;
    namespace: string | undefined;
}): string;
export declare function getFileFormat(key: string): FileFormat | undefined;
export declare function setFileFormat(key: string, format: FileFormat): void;
export declare function encodeLeafPath(path: string[]): string;
/** Test helper. */
export declare function clearFileFormatCache(): void;
