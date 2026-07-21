/**
 * Replaces the `{locale}` (or legacy `{languageTag}`) placeholder in a path
 * pattern with the given locale.
 */
export declare function replaceLocale(path: string, locale: string): string;
/**
 * Parses YAML text into a plain object.
 *
 * - An empty document yields `{}`.
 * - Merge keys (`<<:`) are resolved, as commonly used in Rails locale files.
 */
export declare function parseYamlObject(text: string): Record<string, unknown>;
/**
 * Flattens a parsed YAML object into message entries.
 *
 * Scalar leaves (strings, numbers, booleans) become messages; numbers and
 * booleans are coerced to strings so that unquoted YAML values are not lost.
 * Arrays and nulls are skipped because they cannot be represented as
 * inlang messages.
 */
export declare function flattenYaml(root: Record<string, unknown>): Array<{
    key: string;
    path: string[];
    value: string;
}>;
/**
 * Assigns a value at a nested path, creating intermediate objects.
 */
export declare function assignPath(target: Record<string, unknown>, path: string[], value: string): void;
/**
 * Derives the file extension ("yaml" or "yml") from a path pattern so that
 * exported files match the project's convention.
 */
export declare function resolveExtension(pathPattern: string | undefined): string;
