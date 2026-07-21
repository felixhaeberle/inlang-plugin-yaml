import { type Static } from "@sinclair/typebox";
export type PluginSettings = Static<typeof PluginSettings>;
export declare const PluginSettings: import("@sinclair/typebox").TObject<{
    pathPattern: import("@sinclair/typebox").TUnion<[import("@sinclair/typebox").TString, import("@sinclair/typebox").TRecord<import("@sinclair/typebox").TString, import("@sinclair/typebox").TString>]>;
    variableReferencePattern: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TString>>;
    localeAsRootKey: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TBoolean>;
}>;
