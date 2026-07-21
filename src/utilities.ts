import { parse } from "yaml";

/**
 * Replaces the `{locale}` (or legacy `{languageTag}`) placeholder in a path
 * pattern with the given locale.
 */
export function replaceLocale(path: string, locale: string): string {
  return path.replace(/\{(locale|languageTag)\}/g, locale);
}

/**
 * Parses YAML text into a plain object.
 *
 * - An empty document yields `{}`.
 * - Merge keys (`<<:`) are resolved, as commonly used in Rails locale files.
 */
export function parseYamlObject(text: string): Record<string, unknown> {
  const value = parse(text, { merge: true }) ?? {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(
      "Expected a YAML mapping (key-value pairs) at the document root.",
    );
  }
  return value as Record<string, unknown>;
}

/**
 * Flattens a parsed YAML object into message entries.
 *
 * Scalar leaves (strings, numbers, booleans) become messages; numbers and
 * booleans are coerced to strings so that unquoted YAML values are not lost.
 * Arrays and nulls are skipped because they cannot be represented as
 * inlang messages.
 */
export function flattenYaml(root: Record<string, unknown>): Array<{
  key: string;
  path: string[];
  value: string;
}> {
  const result: Array<{ key: string; path: string[]; value: string }> = [];

  function visit(value: unknown, path: string[]) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      if (path.length > 0) {
        result.push({ key: path.join("."), path, value: String(value) });
      }
      return;
    }

    if (
      value !== null &&
      typeof value === "object" &&
      Array.isArray(value) === false
    ) {
      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, [...path, key]);
      }
    }
  }

  visit(root, []);
  return result;
}

/**
 * Assigns a value at a nested path, creating intermediate objects.
 */
export function assignPath(
  target: Record<string, unknown>,
  path: string[],
  value: string,
) {
  let cursor = target;

  for (const [index, segment] of path.entries()) {
    if (index === path.length - 1) {
      cursor[segment] = value;
      return;
    }

    if (
      typeof cursor[segment] !== "object" ||
      cursor[segment] === null ||
      Array.isArray(cursor[segment])
    ) {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string, unknown>;
  }
}

/**
 * Derives the file extension ("yaml" or "yml") from a path pattern so that
 * exported files match the project's convention.
 */
export function resolveExtension(pathPattern: string | undefined): string {
  return pathPattern?.endsWith(".yml") ? "yml" : "yaml";
}
