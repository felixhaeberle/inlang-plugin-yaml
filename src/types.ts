/**
 * Structural types for the inlang plugin API.
 *
 * Vendored instead of imported from `@inlang/sdk` so that the published
 * bundle carries no dependency on the SDK. Structural compatibility with
 * the real SDK is verified in `src/sdk.test.ts`, which runs against the
 * actual `@inlang/sdk` package.
 */

/**
 * Subset of the inlang project settings that this plugin reads.
 *
 * `locales`/`baseLocale` are the current (v2) properties;
 * `languageTags`/`sourceLanguageTag` are their v1 equivalents which are
 * still supported for older project files.
 */
export type ProjectSettings = {
  baseLocale?: string;
  locales?: string[];
  /** @deprecated v1 name of `baseLocale` */
  sourceLanguageTag?: string;
  /** @deprecated v1 name of `locales` */
  languageTags?: string[];
  modules?: string[];
  [pluginSettings: string]: unknown;
};

// ---------------------------------------------------------------------------
// Current message model (inlang SDK v2): Bundle -> Message -> Variant
// ---------------------------------------------------------------------------

export type VariableReference = { type: "variable-reference"; name: string };

export type FunctionOption = {
  name: string;
  value:
    | { type: "literal"; value: string }
    | { type: "variable-reference"; name: string };
};

export type Expression = {
  type: "expression";
  arg: VariableReference | { type: "literal"; value: string };
  annotation?: {
    type: "function-reference";
    name: string;
    options: FunctionOption[];
  };
};

export type Text = { type: "text"; value: string };

/**
 * Pattern as produced by this plugin (plain text and variable references).
 */
export type Pattern = Array<Text | Expression>;

/**
 * Pattern as read back from the SDK. It may contain elements this plugin
 * cannot represent in plain YAML values (e.g. markup); those throw on export.
 */
export type StoredPattern = Array<Text | Expression | { type: string }>;

/**
 * Only input variables are emitted by this plugin ("local-variable"
 * declarations exist in the SDK but are never created here).
 */
export type Declaration = { type: "input-variable"; name: string };

export type Match =
  | { type: "literal-match"; key: string; value: string }
  | { type: "catchall-match"; key: string };

/**
 * Bundle as read back from the SDK. Declarations are not consumed on export,
 * so they are typed loosely to accept whatever the SDK stores.
 */
export type Bundle = { id: string; declarations: Array<{ type: string }> };

export type Message = {
  id: string;
  bundleId: string;
  locale: string;
  selectors: VariableReference[];
};

export type Variant = {
  id: string;
  messageId: string;
  matches: Match[];
  pattern: StoredPattern;
};

export type BundleImport = { id: string; declarations: Declaration[] };

export type MessageImport = {
  id?: string;
  bundleId: string;
  locale: string;
  selectors?: VariableReference[];
};

export type VariantImport = {
  id: string;
  messageId: string;
  matches: Match[];
  pattern: Pattern;
};

export type ImportFile = {
  /** The locale of the resource file. */
  locale: string;
  /** The binary content of the resource. */
  content: Uint8Array;
  /** Metadata passed along from `toBeImportedFiles`. */
  toBeImportedFilesMetadata?: Record<string, unknown>;
};

export type ExportFile = {
  /** The locale of the resource file. */
  locale: string;
  /** The name of the file, e.g. "en.yaml" or "common-en.yaml". */
  name: string;
  /** The binary content of the resource. */
  content: Uint8Array;
  /** Counterpart of `ImportFile.toBeImportedFilesMetadata`. */
  metadata?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Legacy message model (plugin API v4) — still used by Sherlock (the inlang
// VS Code extension) and other apps that call loadMessages/saveMessages.
// ---------------------------------------------------------------------------

export type LegacyPattern = Array<
  { type: "Text"; value: string } | { type: "VariableReference"; name: string }
>;

export type LegacyVariant = {
  languageTag: string;
  match: string[];
  pattern: LegacyPattern;
};

export type LegacyMessage = {
  id: string;
  alias: Record<string, string>;
  selectors: Array<{ type: "VariableReference"; name: string }>;
  variants: LegacyVariant[];
};

/**
 * Subset of a node:fs/promises-like filesystem that legacy consumers
 * (e.g. Sherlock) pass to loadMessages/saveMessages.
 */
export type NodeishFilesystemSubset = {
  readFile(path: string, options: { encoding: "utf-8" }): Promise<string>;
  readdir(path: string): Promise<string[]>;
  writeFile(path: string, data: string): Promise<void>;
  mkdir(path: string, options?: { recursive: boolean }): Promise<unknown>;
};
