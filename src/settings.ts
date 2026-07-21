import { Type, type Static } from "@sinclair/typebox";

const PathPattern = Type.String({
  pattern: "^(\\./|\\../|/)[^*]*\\{(languageTag|locale)\\}[^*]*\\.ya?ml$",
  title: "Path to language files",
  description:
    "Path pattern to your YAML translation files. Must include `{locale}` (or legacy `{languageTag}`) and end with `.yaml` or `.yml`.",
  examples: [
    "./messages/{locale}.yaml",
    "./config/locales/{locale}.yml",
    "../i18n/{locale}/translation.yaml",
  ],
});

export type PluginSettings = Static<typeof PluginSettings>;
export const PluginSettings = Type.Object({
  pathPattern: Type.Union([
    PathPattern,
    Type.Record(
      Type.String({
        pattern: "^[^.]+$",
        description: "Namespace (dots are not allowed)",
        examples: ["common", "app", "homepage"],
      }),
      PathPattern,
      // reject keys that do not match the namespace pattern
      { additionalProperties: false },
    ),
  ]),
  variableReferencePattern: Type.Optional(
    Type.Array(Type.String(), {
      title: "Variable reference pattern",
      description:
        "Opening and (optional) closing delimiter of variables inside messages. Defaults to `{` and `}`. Use `%{` and `}` for Ruby on Rails style placeholders.",
      examples: [
        ["{", "}"],
        ["%{", "}"],
        ["{{", "}}"],
      ],
    }),
  ),
  localeAsRootKey: Type.Optional(
    Type.Boolean({
      title: "Locale as root key",
      description:
        "Set to true if each YAML file nests all messages under a single root key equal to the locale (Ruby on Rails i18n convention).",
      examples: [true],
    }),
  ),
  plurals: Type.Optional(
    Type.Boolean({
      title: "Plural group detection",
      description:
        "Import CLDR plural groups (e.g. `{ one: ..., other: ... }`) as one message with plural variants instead of separate `key.one`/`key.other` messages. Defaults to true.",
      examples: [false],
    }),
  ),
  preserveFormatting: Type.Optional(
    Type.Boolean({
      title: "Preserve file formatting",
      description:
        "Keep comments, key order, quote styles, indentation, and non-message content (e.g. arrays) of existing YAML files when exporting. Defaults to true.",
      examples: [false],
    }),
  ),
});
