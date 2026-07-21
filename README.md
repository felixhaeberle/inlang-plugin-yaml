# inlang-plugin-yaml

Use YAML files (`.yaml`/`.yml`) as translation resources in [inlang](https://inlang.com) — including Ruby on Rails-style locale files (locale root key, `%{}` placeholders).

The plugin implements the current inlang SDK (v2) resource-plugin API (`toBeImportedFiles`, `importFiles`, `exportFiles`) and retains the legacy `loadMessages`/`saveMessages` callbacks for older consumers such as [Sherlock](https://inlang.com/m/r7kp499g/app-inlang-ideExtension) (the inlang VS Code extension).

## Installation

Add the module and its settings to your `project.inlang/settings.json`:

```json
{
  "$schema": "https://inlang.com/schema/project-settings",
  "baseLocale": "en",
  "locales": ["en", "de"],
  "modules": [
    "https://cdn.jsdelivr.net/gh/felixhaeberle/inlang-plugin-yaml@3/dist/index.js"
  ],
  "plugin.felixhaeberle.yaml": {
    "pathPattern": "./messages/{locale}.yaml"
  }
}
```

The plugin is distributed via [jsDelivr](https://www.jsdelivr.com/) directly from GitHub tags. `@3` resolves to the latest `3.x` release; pin an exact version (e.g. `@3.0.0`) for fully reproducible builds.

A complete runnable setup is in [example](./example/).

## Settings

```typescript
type PluginSettings = {
  pathPattern: string | Record<string, string>;
  variableReferencePattern?: [string] | [string, string];
  localeAsRootKey?: boolean;
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

## Behavior and limitations

- Nested keys are flattened with a dot: `menu: { home: ... }` becomes the message ID `menu.home`. The modern import/export API round-trips nested keys and literal dotted keys (`"a.b": ...`) losslessly; the legacy API re-nests dotted IDs on save.
- Unquoted scalars (`version: 42`, `enabled: true`) are imported as strings instead of being dropped.
- Arrays and `null` values are skipped — they cannot be represented as inlang messages.
- YAML merge keys (`<<:`) and anchors are resolved on import and written back expanded.
- Plurals/selectors/markup cannot be expressed in flat YAML values; exporting such messages throws.

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
