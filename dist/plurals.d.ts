import type { Declaration, Match, VariableReference } from "./types.js";
/**
 * CLDR plural categories in canonical order.
 */
export declare const PLURAL_CATEGORIES: readonly ["zero", "one", "two", "few", "many", "other"];
export type PluralCategory = (typeof PLURAL_CATEGORIES)[number];
/**
 * Name of the input variable a plural message depends on and of the derived
 * selector variable (matching the convention used by inlang apps).
 */
export declare const COUNT_INPUT = "count";
export declare const PLURAL_SELECTOR = "countPlural";
/**
 * A YAML mapping is treated as a plural group when it has at least two keys,
 * every key is a CLDR plural category, "other" is present, and every value
 * is a scalar.
 *
 * @example { one: "1 item", other: "%{count} items" }
 */
export declare function asPluralGroup(value: unknown): Partial<Record<PluralCategory, string>> | undefined;
/**
 * Declarations for a plural bundle: the `count` input and a local
 * `countPlural` variable that applies the `plural` function to it.
 */
export declare function pluralDeclarations(): Declaration[];
export declare function pluralSelectors(): VariableReference[];
/**
 * "other" is the catch-all category; all others match literally.
 */
export declare function matchesForCategory(category: PluralCategory): Match[];
/**
 * Maps a variant's matches back to its plural category, or undefined when
 * the matches cannot be expressed as a plural category.
 */
export declare function categoryFromMatches(matches: Match[]): PluralCategory | undefined;
/**
 * Orders plural categories canonically (zero, one, two, few, many, other).
 */
export declare function sortCategories<Value>(record: Partial<Record<PluralCategory, Value>>): Array<[PluralCategory, Value]>;
