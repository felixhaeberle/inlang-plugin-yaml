import { Document } from "yaml";
/**
 * Parses YAML text into a Document (which retains comments, key order, and
 * scalar styles). Merge keys (`<<:`) are enabled, as commonly used in Rails
 * locale files.
 *
 * @param context human-readable description of the file for error messages
 */
export declare function parseYamlDocument(text: string, context: string): Document;
/**
 * Converts a parsed Document into a plain object (aliases and merge keys
 * resolved). An empty document yields `{}`.
 */
export declare function toPlainObject(document: Document, context: string): Record<string, unknown>;
/**
 * Detects the indentation width of an existing YAML file (defaults to 2).
 */
export declare function detectIndent(text: string): number;
export declare function stringifyDocument(document: Document, indent: number): string;
/**
 * Sets a scalar value at a path, creating intermediate maps. Unchanged
 * values are left untouched so their original scalar style (quoting,
 * unquoted numbers/booleans) and trailing comments survive.
 *
 * Note: path segments are matched as string keys; files using non-string
 * keys (e.g. `true:` or `1:`) keep working but lose style preservation for
 * those keys.
 */
export declare function setValueAtPath(document: Document, path: string[], value: string): void;
/**
 * Deletes a path and prunes ancestor maps that became empty.
 */
export declare function deleteAndPrune(document: Document, path: string[]): void;
