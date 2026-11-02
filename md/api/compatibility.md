# Compatibility

What the package keeps working for existing consumers — and what remains undecided.

## Retained surfaces (supported in 1.x, frozen)

- **Subpaths**: `./api`, `./intelligence`, `./ai`, `./incremental`, `./documentation-compiler`, `./documentation-relations`, `./examples`, `./languages` (plus neutral `.`, `./cli`, `./config`, `./plugins`, `./react`, `./renderers`, `./content`, `./state`).
- **Root**: `intelligence`, `documentationRelations`, `examples`, `state` namespaces; `openApi`/`mermaid`; `discoverSourceFiles`, `detectProject`, hooks, engine.
- **CLI**: `plan`, `analyze`, `coverage`, `render`, `validate-output`, `diff`; `content *`; `changes`, `impact`, `update`; `ai *`; `integrations *`.
- **Config**: `content.pipeline: "legacy"`, `api.*`, `architecture.*`, `ai.*`.

## Legacy pipeline behavior

With `content: { pipeline: "legacy" }` (plus `api.enabled` for reference), builds run knowledge building, API symbols, dependency classification, framework detection, integration planning, and example composition into the same renderers, manifest, and validation gate. The repository's own docs use this path deliberately. Covered by dedicated end-to-end tests.

## Open decision

Whether this surface is removed in a future major is explicitly undecided. Nothing is deprecated, renamed, or version-bumped to anticipate it. A removal would need its own migration plan; until then every listed surface is supported. Do not design against its disappearance.

## Known duplicate work

`engine.build` runs legacy pipeline stages and canonical materialization in one invocation — deterministic, root-bounded, reconciled-or-overwritten output, i.e. redundant work rather than a correctness defect. Unification is deferred to the same future decision above.
