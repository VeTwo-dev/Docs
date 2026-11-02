# `docs integrations` Group

Manage ecosystem integrations (capability-driven, deterministic; runs inside the legacy planning path, not the default build):

```text
docs integrations list      # available integrations
docs integrations plan      # which would be selected for this project, and why
docs integrations validate  # validate selected integrations
```

Shipped integrations include syntax highlighting, diagrams, type-aware code, and graph visualization (capabilities such as `graph-visualization`); `plan` reports per-integration selection with reasons, and the build logs `selected:`/`skipped:` lines. Adding an integration to the default path just to use it is out of scope — integration requires product purpose, not Knip silence. See [Compatibility](../api/compatibility.md).
