# `docs doctor`

```text
docs doctor [--json]
```

Diagnose the project setup. Checks, in order: Node.js version, `package.json`, configuration file, source directory, README, CHANGELOG (advisory), TypeScript detection (informational for content-first projects), Git (advisory), required runtime dependencies, engine-state health, and a best-effort legacy architecture/quality analysis.

## Results

Results print as a status table; `--json` emits `{ checks, summary }`. Blocking failures exit nonzero; advisories warn only. A clean project ends with all checks passed and exit 0.

## Example

```bash
docs doctor
# ... status table, ending with all checks passed and exit 0
```

Fixes for common failures live in [Troubleshooting](../troubleshooting/index.md). The skill workflow treats blocking `doctor` failures as the audit result (see the repository `skills/docs-bootstrap` skill).
