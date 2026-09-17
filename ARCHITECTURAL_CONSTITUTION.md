# Architectural Constitution

The rules governing @vetwo/docs. These are non-negotiable architectural constraints.

## Core Invariants

1. **Core must not depend on providers.** The core never imports OpenAI, Anthropic, Gemini, or any specific AI provider.

2. **Core must not depend on renderers.** The documentation intelligence layer never imports Next.js, React, or any specific CSS framework.

3. **Knowledge must not depend on rendering.** The knowledge graph and symbol extraction are independent of output format.

4. **Rendering must not mutate project knowledge.** Renderers are pure functions: IR → files.

5. **Providers must not write output files.** AI providers produce IR blocks, never final markup.

6. **Generated output must not become the source of truth.** `.vetwo/docs/` is the canonical state directory.

7. **User content must never be silently overwritten.** All generated artifacts track ownership.

8. **Deterministic analysis happens before AI reasoning.** The compiler produces architecture before AI enriches it.

9. **Public APIs remain stable.** Breaking changes require version bumps and migration guidance.

10. **Internal implementation details remain replaceable.** No module depends on another's internals.

## Dependency Direction

```
CLI → Engine → Pipeline → Domain Layers → Utilities
```

Lower layers never depend on higher layers.

## Documentation IR Contract

The IR is the sole contract between compiler and renderers. It is versioned and immutable.

```
Project Knowledge → Documentation Planning → Documentation IR → Renderer
```

All output targets consume the same IR.

## Single Source of Truth

```
Project Source → Project Knowledge → Documentation IR → Generated Documentation → Rendered Output
```

Generated output never becomes the canonical source.

## State Boundary

All engine state lives under `.vetwo/docs/`. No competing state directories.

## Security

- Secrets are redacted in logs and errors
- Path traversal is blocked at every boundary
- Symlinks are validated to stay within project root
- HTML output is escaped to prevent XSS
- MDX custom blocks are sanitized
- Configuration values are validated for dangerous patterns

## Concurrency

- Process locks prevent concurrent state corruption
- Atomic writes (write-temp-then-rename) prevent partial state
- Bounded concurrency prevents resource exhaustion

## Error Handling

- Every error has a stable code, message, and recovery suggestion
- Errors are classified by severity (recoverable vs fatal)
- Cache corruption is detected and rebuilt
- State corruption is detected and recovered

## Testing

- Unit tests for utilities, parsers, analyzers
- Integration tests for pipeline stages
- Security tests for path traversal, XSS, secrets
- Golden tests for generated output
