import type { Bundle, ExportFile, Message, ProjectSettings, Variant } from "../types.js";
export declare function exportFiles(args: {
    bundles: Bundle[];
    messages: Message[];
    variants: Variant[];
    settings: ProjectSettings;
}): Promise<ExportFile[]>;
