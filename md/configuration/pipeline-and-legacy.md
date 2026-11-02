# Content Pipeline and Legacy Options

## Selecting the pipeline

```js
export default defineDocs({
  content: { pipeline: "canonical" },  // default: authored Markdown/MDX only
  // content: { pipeline: "legacy" },  // opt-in: inference from TS sources
});
```

`canonical` runs discovery → normalization → site model → IR → renderers with no source analysis. `legacy` restores knowledge building, API symbols, dependency classification, framework detection, integration planning, and example composition into the same renderers. The repository's own docs use `legacy` deliberately (API-reference material). The future removal of the legacy surface is explicitly undecided — nothing here is deprecated.

## Legacy-only keys

Read meaningfully only under `content.pipeline: "legacy"` (or by the explicit analysis commands):

```js
export default defineDocs({
  content: { pipeline: "legacy" },
  api: {
    enabled: true,                    // default false
    source: "./src",
    include: ["src/**/*.ts"],         // default []
    exclude: ["**/*.test.*", "**/*.spec.*", "**/*.d.ts"],
    readme: true,
  },
  architecture: {
    sections: {},                     // enable/rename inferred sections by id
    excludePages: [],                 // slugs to drop from inferred architecture
  },
  ai: {
    enabled: false,                   // default off; nothing AI runs by default
    providers: [],                    // [{ id, default?, config? }]
    fallbackChain: [],                // provider IDs in order
    defaultAudience: "developer",
    defaultVoice: "neutral",
    maxRevisions: 3,
    acceptThreshold: 0.7,
  },
});
```

The `agent` key (`{ enabled, skill: { path } }`) configures the documentation-agent workspace scaffolded by `init`, independent of the pipeline choice.
