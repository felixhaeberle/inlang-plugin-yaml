/**
 * Creates a deterministic message id so that re-importing the same file
 * upserts messages instead of duplicating them.
 *
 * The id encodes the original key path, which `exportFiles` uses to decide
 * whether a dotted bundle id was a nested key (`a: { b: ... }`) or a literal
 * flat key (`"a.b": ...`).
 */
export declare function createMessageId(args: {
    locale: string;
    bundleId: string;
    path: string[];
}): string;
export declare function createVariantId(messageId: string): string;
export declare function getMessagePath(messageId: string): string[] | undefined;
