import type { BundleImport, ImportFile, MessageImport, ProjectSettings, VariantImport } from "../types.js";
export declare function importFiles(args: {
    files: ImportFile[];
    settings: ProjectSettings;
}): Promise<{
    bundles: BundleImport[];
    messages: MessageImport[];
    variants: VariantImport[];
}>;
