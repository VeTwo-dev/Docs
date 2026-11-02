# Errors

Thrown failures are `DocsError` instances carrying a machine-readable `code` and optional `cause`. Subclasses: `ConfigurationError`, `ValidationError`, `BuildError`, `PluginError`, `ThemeError`, `RendererError`, `MarkdownError`, `SearchError` (plus `PagefindError`), `TypeDocError`, `CacheError`, `CliError`, `InternalError`.

## Codes (35, `DOCS_*`)

`CONFIG_INVALID`, `SOURCE_NOT_FOUND`, `BUILD_FAILED`, `MARKDOWN_ERROR`, `MARKDOWN_PARSE_ERROR`, `PLUGIN_ERROR`, `PLUGIN_NOT_FOUND`, `THEME_ERROR`, `THEME_NOT_FOUND`, `RENDER_ERROR`, `SEARCH_ERROR`, `OUTPUT_ERROR`, `OUTPUT_WRITE_FAILED`, `VALIDATION_FAILED`, `INIT_FAILED`, `CONFLICT`, `INTERRUPTED`, `STATE_CORRUPTED`, `NETWORK_ERROR`, and more — one per failure category.

## Handling pattern

```ts
try {
  await build({ rootDir: ".", logger });
} catch (error) {
  if (error instanceof Error && "code" in error && error.code === "DOCS_CONFIG_INVALID") {
    // Handle invalid config
  }
  throw error;
}
```

`DocsError` and `ErrorCode` live in the implementation (`src/errors/`); there is no published `./errors` subpath, so compare against the `DOCS_*` string literals. CLI exit mapping: configuration → 2, build → 3, internal → 4, conflict → 5, validation → 6. See [Exit Codes](../cli/exit-codes.md).
