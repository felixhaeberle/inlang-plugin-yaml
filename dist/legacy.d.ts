import type { LegacyMessage, NodeishFilesystemSubset, ProjectSettings } from "./types.js";
/**
 * Legacy plugin API (v4), still called by apps like Sherlock (the inlang
 * VS Code extension). New apps use importFiles/exportFiles instead.
 *
 * Notes:
 * - nested YAML keys are flattened with a dot (`a.b`) on load and re-nested
 *   on save
 * - plural groups are exposed as flat `key.one`/`key.other` messages (the
 *   modern API models them as real plural variants)
 * - saving updates existing files in place, preserving comments, key order,
 *   quote styles, indentation, and non-message content
 */
export declare function loadMessages(args: {
    settings: ProjectSettings;
    nodeishFs: NodeishFilesystemSubset;
}): Promise<LegacyMessage[]>;
export declare function saveMessages(args: {
    messages: LegacyMessage[];
    settings: ProjectSettings;
    nodeishFs: NodeishFilesystemSubset;
}): Promise<void>;
