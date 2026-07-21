import { type PluralCategory } from "./plurals.js";
/**
 * Replaces the `{locale}` (or legacy `{languageTag}`) placeholder in a path
 * pattern with the given locale.
 */
export declare function replaceLocale(path: string, locale: string): string;
export type MessageEntry = {
    kind: "message";
    key: string;
    path: string[];
    value: string;
} | {
    kind: "plural";
    key: string;
    path: string[];
    categories: Partial<Record<PluralCategory, string>>;
};
/**
 * Walks a parsed YAML object and collects message entries.
 *
 * - Scalar leaves (strings, numbers, booleans) become messages; numbers and
 *   booleans are coerced to strings so that unquoted YAML values are not
 *   lost.
 * - With `plurals` enabled, mappings whose keys are CLDR plural categories
 *   (e.g. `{ one: ..., other: ... }`) become a single plural entry.
 * - Arrays and nulls are skipped because they cannot be represented as
 *   inlang messages.
 */
export declare function collectEntries(root: Record<string, unknown>, options: {
    plurals: boolean;
}): MessageEntry[];
/**
 * Assigns a value at a nested path, creating intermediate objects.
 */
export declare function assignPath(target: Record<string, unknown>, path: string[], value: unknown): void;
/**
 * Derives the file extension ("yaml" or "yml") from a path pattern so that
 * exported files match the project's convention.
 */
export declare function resolveExtension(pathPattern: string | undefined): string;
