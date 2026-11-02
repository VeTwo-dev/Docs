# Analysis Commands (Explicit Inference)

`plan`, `analyze`, `coverage`, `render`, `validate-output`, and `diff` run the retained inference tooling explicitly. They are supported, but they are **not** part of the default content-first workflow — invoking them never changes the default pipeline. Background: [Compatibility](../api/compatibility.md).

```text
docs plan [--json]            # compile and display the inferred documentation architecture
docs analyze                  # project archetype, personas, documentation gaps
docs coverage [--json]        # documentation coverage by area
docs render [--target nextjs] [-o|--out documentation-site]
                              # render the compiled IR as a static site
docs validate-output [-o|--out <dir>] [--json]
                              # validate workspace boundaries, routes, links, assets, CSS, search
docs diff [--save]            # diff inferred architecture vs last saved plan (or persist a baseline)
```

- `render --target` accepts `nextjs` (default); `-o` defaults to `documentation-site`.
- `validate-output -o` defaults to the configured workspace directory when omitted.
- `coverage`/`plan` accept `--json` for machine-readable output.

Example:

```bash
docs analyze
docs plan --json | head -50
```

Common mistake: expecting these commands to replace authored content — they analyze and report; the site still renders what you wrote unless the legacy pipeline is opted in.
