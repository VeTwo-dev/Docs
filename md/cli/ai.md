# `docs ai` Group

Manage AI documentation providers (retained legacy-compatible surface; nothing here runs during a default build):

```text
docs ai list                  # list available providers (also: docs ai providers)
docs ai use <provider>        # set the default AI provider
docs ai info [provider]       # details about a provider (or the default)
docs ai capabilities [provider]  # capability flags for a provider
docs ai doctor                # check provider configuration health
docs ai review [proposal]     # review pending AI content proposals
```

Provider packages are loaded dynamically by name (`createAIProviderFactory` convention); configuration lives under the `ai.*` config keys. See [Compatibility](../api/compatibility.md).
