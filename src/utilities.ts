import { asPluralGroup, type PluralCategory } from "./plurals.js";

/**
 * Replaces the `{locale}` (or legacy `{languageTag}`) placeholder in a path
 * pattern with the given locale.
 */
export function replaceLocale(path: string, locale: string): string {
  return path.replace(/\{(locale|languageTag)\}/g, locale);
}

export type MessageEntry =
  | { kind: "message"; key: string; path: string[]; value: string }
  | {
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
export function collectEntries(
  root: Record<string, unknown>,
  options: { plurals: boolean },
): MessageEntry[] {
  const result: MessageEntry[] = [];

  function visit(value: unknown, path: string[]) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      if (path.length > 0) {
        result.push({
          kind: "message",
          key: path.join("."),
          path,
          value: String(value),
        });
      }
      return;
    }

    if (
      value !== null &&
      typeof value === "object" &&
      Array.isArray(value) === false
    ) {
      if (options.plurals && path.length > 0) {
        const categories = asPluralGroup(value);
        if (categories !== undefined) {
          result.push({ kind: "plural", key: path.join("."), path, categories });
          return;
        }
      }
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
  value: unknown,
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
