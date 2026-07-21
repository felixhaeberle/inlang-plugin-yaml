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

const cache = new Map<string, FileFormat>();

export function cacheKey(args: {
  settings: unknown;
  locale: string;
  namespace: string | undefined;
}): string {
  return JSON.stringify([args.settings ?? null, args.locale, args.namespace]);
}

export function getFileFormat(key: string): FileFormat | undefined {
  return cache.get(key);
}

export function setFileFormat(key: string, format: FileFormat): void {
  cache.set(key, format);
}

export function encodeLeafPath(path: string[]): string {
  return JSON.stringify(path);
}

/** Test helper. */
export function clearFileFormatCache(): void {
  cache.clear();
}
