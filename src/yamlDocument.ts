import { Document, isMap, parseDocument } from "yaml";

/**
 * Parses YAML text into a Document (which retains comments, key order, and
 * scalar styles). Merge keys (`<<:`) are enabled, as commonly used in Rails
 * locale files.
 *
 * @param context human-readable description of the file for error messages
 */
export function parseYamlDocument(text: string, context: string): Document {
  const document = parseDocument(text, { merge: true });
  if (document.errors.length > 0) {
    const error = document.errors[0]!;
    throw new Error(`Invalid YAML in ${context}: ${error.message}`);
  }
  return document;
}

/**
 * Converts a parsed Document into a plain object (aliases and merge keys
 * resolved). An empty document yields `{}`.
 */
export function toPlainObject(
  document: Document,
  context: string,
): Record<string, unknown> {
  const value = document.toJS() ?? {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(
      `Expected a YAML mapping (key-value pairs) at the document root in ${context}.`,
    );
  }
  return value as Record<string, unknown>;
}

/**
 * Detects the indentation width of an existing YAML file (defaults to 2).
 */
export function detectIndent(text: string): number {
  const match = text.match(/^( +)\S/m);
  const width = match?.[1]?.length ?? 2;
  return Math.min(Math.max(width, 1), 8);
}

export function stringifyDocument(
  document: Document,
  indent: number,
): string {
  return document.toString({ indent, lineWidth: 0 });
}

/**
 * Sets a scalar value at a path, creating intermediate maps. Unchanged
 * values are left untouched so their original scalar style (quoting,
 * unquoted numbers/booleans) and trailing comments survive.
 *
 * Note: path segments are matched as string keys; files using non-string
 * keys (e.g. `true:` or `1:`) keep working but lose style preservation for
 * those keys.
 */
export function setValueAtPath(
  document: Document,
  path: string[],
  value: string,
): void {
  const existing = document.getIn(path);
  if (
    typeof existing === "string" ||
    typeof existing === "number" ||
    typeof existing === "boolean"
  ) {
    if (String(existing) === value) {
      return;
    }
  }
  // an intermediate node may exist as a scalar (e.g. `a: text` while a
  // message `a.b` was added) — replace it so setIn can create the map
  for (let depth = 1; depth < path.length; depth++) {
    const ancestor = path.slice(0, depth);
    const node = document.getIn(ancestor, true);
    if (node !== undefined && isMap(node) === false) {
      document.deleteIn(ancestor);
      break;
    }
  }
  document.setIn(path, value);
}

/**
 * Deletes a path and prunes ancestor maps that became empty.
 */
export function deleteAndPrune(document: Document, path: string[]): void {
  document.deleteIn(path);
  for (let depth = path.length - 1; depth > 0; depth--) {
    const ancestor = path.slice(0, depth);
    const node = document.getIn(ancestor, true);
    if (isMap(node) && node.items.length === 0) {
      document.deleteIn(ancestor);
    } else {
      break;
    }
  }
}
