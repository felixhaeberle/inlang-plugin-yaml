import type { LegacyMessage, NodeishFilesystemSubset, ProjectSettings } from "./types.js";
/**
 * Legacy plugin API (v4), still called by apps like Sherlock (the inlang
 * VS Code extension). New apps use importFiles/exportFiles instead.
 *
 * Note: the legacy API flattens nested YAML keys with a dot (`a.b`) on load
 * and re-nests them on save.
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
