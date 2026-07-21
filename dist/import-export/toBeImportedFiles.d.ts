import type { ProjectSettings } from "../types.js";
export declare function toBeImportedFiles(args: {
    settings: ProjectSettings;
}): Promise<Array<{
    locale: string;
    path: string;
    metadata?: Record<string, unknown>;
}>>;
