# Changelog

## 4.0.0 (2026-07-21)

### Format-preserving export

Exporting now updates existing YAML files in place instead of regenerating them: comments, blank lines, key order, quote styles, indentation width, and non-message content (arrays, `null` values) all survive a round-trip, and unchanged values keep their exact representation. Deleted messages are removed and emptied parent keys are pruned. Disable with `"preserveFormatting": false`.

This also fixes a data-loss issue in 3.0.0 where keys that are not messages (e.g. arrays like Rails' `day_names`) disappeared from files on export.

### Native plural support

CLDR plural groups (`{ one: ..., other: ... }`) are imported as a single message with plural variants (a `count` input, a `countPlural` selector via the `plural` function, and literal/catch-all matches) instead of separate `key.one`/`key.other` messages — and are exported back to nested groups. Disable with `"plurals": false`.

**Breaking**: projects with plural-category groups now get one bundle per group instead of one per category. Set `"plurals": false` for the old behavior.

### Other improvements

- YAML parse errors now name the file/locale they occurred in
- export runs in linear time (indexed lookups instead of per-message scans)
- the legacy (Sherlock) save path also preserves formatting and removes deleted messages

## 3.0.0 (2026-07-21)

Complete rewrite for the current inlang SDK (v2). The plugin previously targeted `@inlang/core` 0.7.8 (early 2023) and did not work with any current inlang app.

- modern resource-plugin API: `toBeImportedFiles`, `importFiles`, `exportFiles`
- legacy `loadMessages`/`saveMessages` retained for Sherlock
- plugin key changed from `felixhaeberle.inlangPluginYaml` to `plugin.felixhaeberle.yaml`
- namespaces via `Record` pathPattern (`namespace:key` message IDs)
- configurable `variableReferencePattern` (default `{`/`}`)
- `localeAsRootKey` setting for Ruby on Rails-style locale files
- YAML merge keys (`<<:`) and anchors resolved on import
- unquoted scalars (numbers, booleans) imported as strings instead of dropped
