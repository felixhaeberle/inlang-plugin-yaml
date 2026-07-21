const MESSAGE_ID_PREFIX = "plugin.felixhaeberle.yaml:";

/**
 * Creates a deterministic message id so that re-importing the same file
 * upserts messages instead of duplicating them.
 *
 * The id encodes the original key path, which `exportFiles` uses to decide
 * whether a dotted bundle id was a nested key (`a: { b: ... }`) or a literal
 * flat key (`"a.b": ...`).
 */
export function createMessageId(args: {
  locale: string;
  bundleId: string;
  path: string[];
}): string {
  return `${MESSAGE_ID_PREFIX}${encodeURIComponent(JSON.stringify(args))}`;
}

export function createVariantId(messageId: string, category?: string): string {
  return `${MESSAGE_ID_PREFIX}variant:${encodeURIComponent(messageId)}${
    category === undefined ? "" : `:${category}`
  }`;
}

export function getMessagePath(messageId: string): string[] | undefined {
  if (messageId.startsWith(MESSAGE_ID_PREFIX) === false) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(
      decodeURIComponent(messageId.slice(MESSAGE_ID_PREFIX.length)),
    );
    return Array.isArray(parsed.path) &&
      parsed.path.every((segment: unknown) => typeof segment === "string")
      ? parsed.path
      : undefined;
  } catch {
    return undefined;
  }
}
