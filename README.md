# inlang-plugin-yaml

Use YAML files (`.yaml`/`.yml`) as translation resources in [inlang](https://inlang.com) — including Ruby on Rails-style locale files (locale root key, `%{}` placeholders).

**Highlights:**

- **Format-preserving**: exporting updates your existing files in place — comments, key order, blank lines, quote styles, indentation, and non-message content (arrays, etc.) survive. Diffs only show what actually changed.
- **Real plurals**: CLDR plural groups (`one:`/`other:` …) become a single message with plural variants in inlang — not fake `key.one` messages — and are written back as nested groups.
- **Rails-ready**: locale root keys, `%{count}` placeholders, merge keys (`<<:`), and anchors all work.

The plugin implements the current inlang SDK (v2) resource-plugin API (`toBeImportedFiles`, `importFiles`, `exportFiles`) and retains the legacy `loadMessages`/`saveMessages` callbacks for older consumers such as [Sherlock](https://inlang.com/m/r7kp499g/app-inlang-ideExtension) (the inlang VS Code extension).

## Installation

Add the module and its settings to your `project.inlang/settings.json`:

```json
{
  "$schema": "https://inlang.com/schema/project-settings",
  "baseLocale": "en",
  "locales": ["en", "de"],
  "modules": [
    "https://cdn.jsdelivr.net/gh/felixhaeberle/inlang-plugin-yaml@4/dist/index.js"
  ],
  "plugin.felixhaeberle.yaml": {
    "pathPattern": "./messages/{locale}.yaml"
  }
}
```

The plugin is distributed via [jsDelivr](https://www.jsdelivr.com/) directly from GitHub tags. `@4` resolves to the latest `4.x` release; pin an exact version (e.g. `@4.0.0`) for fully reproducible builds.

A complete runnable setup is in [example](./example/).

## Settings

```typescript
type PluginSettings = {
  pathPattern: string | Record<string, string>;
  variableReferencePattern?: [string] | [string, string];
  localeAsRootKey?: boolean;
  plurals?: boolean; // default: true
  preserveFormatting?: boolean; // default: true
};
```

### `pathPattern`

Where your YAML files live. Must contain `{locale}` (the legacy `{languageTag}` placeholder is also supported) and end with `.yaml` or `.yml`.

```json
"plugin.felixhaeberle.yaml": {
  "pathPattern": "./messages/{locale}.yaml"
}
```

**With namespaces** — one file per namespace, message IDs are prefixed with `namespace:`:

```json
"plugin.felixhaeberle.yaml": {
  "pathPattern": {
    "common": "./messages/{locale}/common.yaml",
    "auth": "./messages/{locale}/auth.yaml"
  }
}
```

### `variableReferencePattern`

Opening and (optional) closing delimiter of variables inside messages. Defaults to `["{", "}"]`.

```json
"variableReferencePattern": ["%{", "}"]
```

| Style | Pattern |
| --- | --- |
| Default / ICU-like | `["{", "}"]` |
| Ruby on Rails / Symfony | `["%{", "}"]` |
| i18next | `["{{", "}}"]` |

### `localeAsRootKey`

Set to `true` when each file nests all messages under a single root key equal to the locale — the Ruby on Rails i18n convention:

```json
"plugin.felixhaeberle.yaml": {
  "pathPattern": "./config/locales/{locale}.yml",
  "variableReferencePattern": ["%{", "}"],
  "localeAsRootKey": true
}
```

```yaml
# config/locales/en.yml
en:
  hello: "Hi %{user}!"
  activerecord:
    errors: "Something went wrong"
```

### `plurals`

Enabled by default. A mapping whose keys are CLDR plural categories (`zero`, `one`, `two`, `few`, `many`, `other` — with at least two entries and `other` present) is imported as **one** message with plural variants:

```yaml
inbox:
  one: You have one message
  other: "You have %{count} messages"
```

becomes a single `inbox` message with a `count` input, a `countPlural` selector (via the `plural` function), and one variant per category — so translation editors show it as a proper plural, and adding a language with more plural forms (e.g. Polish `few`/`many`) just works. On export the nested group is written back, categories in canonical CLDR order for new files. Set `"plurals": false` to import the categories as plain `inbox.one`/`inbox.other` messages instead.

### `preserveFormatting`

Enabled by default. The plugin remembers each imported file and applies changes to it in place instead of regenerating it:

- comments, blank lines, key order, quote styles, and indentation width are preserved
- non-message content (arrays like `weekdays:`, `null` values) is left untouched
- unchanged values keep their exact representation (an unquoted `42` stays `42`)
- deleted messages are removed, and parent keys that became empty are pruned
- brand-new files (e.g. a newly added locale) are generated cleanly with 2-space indentation

Set `"preserveFormatting": false` to always regenerate files from scratch.

## Behavior and limitations

- Nested keys are flattened with a dot: `menu: { home: ... }` becomes the message ID `menu.home`. The modern import/export API round-trips nested keys and literal dotted keys (`"a.b": ...`) losslessly; the legacy API re-nests dotted IDs on save.
- Unquoted scalars (`version: 42`, `enabled: true`) are imported as strings instead of being dropped.
- Arrays and `null` values are not importable as messages, but they survive round-trips of existing files thanks to format preservation.
- YAML merge keys (`<<:`) and anchors are resolved on import; unchanged keys keep their aliases in the file, edited ones are written as explicit overrides.
- Messages beyond plain values and plural variants (custom selectors, markup, multiple unmatched variants) cannot be expressed in YAML; exporting them throws a descriptive error.
- The legacy (Sherlock) API exposes plural groups as flat `key.one`/`key.other` messages; native plural variants are a modern-API feature.

## Developing

```bash
npm install
npm test        # typecheck + unit tests + integration tests against the real @inlang/sdk
npm run build   # bundle dist/index.js + emit type declarations
npm run dev     # watch mode
```

## Publishing a new version

1. `npm run build` and commit the new `dist/` output (jsDelivr serves the committed files).
2. Create a git tag using [SemVer](https://semver.org/) **without** a `v` prefix (e.g. `3.0.1`) and push it.
3. jsDelivr picks up the tag automatically. Note: version URLs are cached permanently, branch URLs (e.g. `@main`) for ~12 hours.
