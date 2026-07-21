import type { Declaration, Match, VariableReference } from "./types.js";

/**
 * CLDR plural categories in canonical order.
 */
export const PLURAL_CATEGORIES = [
  "zero",
  "one",
  "two",
  "few",
  "many",
  "other",
] as const;

export type PluralCategory = (typeof PLURAL_CATEGORIES)[number];

const CATEGORY_SET: ReadonlySet<string> = new Set(PLURAL_CATEGORIES);

/**
 * Name of the input variable a plural message depends on and of the derived
 * selector variable (matching the convention used by inlang apps).
 */
export const COUNT_INPUT = "count";
export const PLURAL_SELECTOR = "countPlural";

/**
 * A YAML mapping is treated as a plural group when it has at least two keys,
 * every key is a CLDR plural category, "other" is present, and every value
 * is a scalar.
 *
 * @example { one: "1 item", other: "%{count} items" }
 */
export function asPluralGroup(
  value: unknown,
): Partial<Record<PluralCategory, string>> | undefined {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return undefined;
  }
  const entries = Object.entries(value);
  if (entries.length < 2 || "other" in value === false) {
    return undefined;
  }
  const group: Partial<Record<PluralCategory, string>> = {};
  for (const [key, scalar] of entries) {
    if (CATEGORY_SET.has(key) === false) {
      return undefined;
    }
    if (
      typeof scalar !== "string" &&
      typeof scalar !== "number" &&
      typeof scalar !== "boolean"
    ) {
      return undefined;
    }
    group[key as PluralCategory] = String(scalar);
  }
  return group;
}

/**
 * Declarations for a plural bundle: the `count` input and a local
 * `countPlural` variable that applies the `plural` function to it.
 */
export function pluralDeclarations(): Declaration[] {
  return [
    { type: "input-variable", name: COUNT_INPUT },
    {
      type: "local-variable",
      name: PLURAL_SELECTOR,
      value: {
        type: "expression",
        arg: { type: "variable-reference", name: COUNT_INPUT },
        annotation: { type: "function-reference", name: "plural", options: [] },
      },
    },
  ];
}

export function pluralSelectors(): VariableReference[] {
  return [{ type: "variable-reference", name: PLURAL_SELECTOR }];
}

/**
 * "other" is the catch-all category; all others match literally.
 */
export function matchesForCategory(category: PluralCategory): Match[] {
  return category === "other"
    ? [{ type: "catchall-match", key: PLURAL_SELECTOR }]
    : [{ type: "literal-match", key: PLURAL_SELECTOR, value: category }];
}

/**
 * Maps a variant's matches back to its plural category, or undefined when
 * the matches cannot be expressed as a plural category.
 */
export function categoryFromMatches(
  matches: Match[],
): PluralCategory | undefined {
  if (matches.length !== 1) {
    return undefined;
  }
  const match = matches[0]!;
  if (match.type === "catchall-match") {
    return "other";
  }
  return CATEGORY_SET.has(match.value)
    ? (match.value as PluralCategory)
    : undefined;
}

/**
 * Orders plural categories canonically (zero, one, two, few, many, other).
 */
export function sortCategories<Value>(
  record: Partial<Record<PluralCategory, Value>>,
): Array<[PluralCategory, Value]> {
  const result: Array<[PluralCategory, Value]> = [];
  for (const category of PLURAL_CATEGORIES) {
    const value = record[category];
    if (value !== undefined) {
      result.push([category, value]);
    }
  }
  return result;
}
