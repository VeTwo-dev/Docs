# Errors and Diagnostics

How failures surface and where to take them.

## Failure philosophy

Loud, specific, nonzero. Duplicate routes name both files. Invalid MDX names the path. Missing entry points name the missing file. A failed build exits nonzero and never reports success — validation errors are errors, not warnings.

## Codes and exits

- Machine-readable `DOCS_*` codes on thrown errors (`DOCS_CONFIG_INVALID`, `DOCS_BUILD_FAILED`, `DOCS_VALIDATION_FAILED`, … — 35 total), plus numeric CLI exits (`0` success, `1` general, `2` configuration, `3` build, `4` internal, `5` conflict, `6` validation, `130` interrupted).
- `doctor` separates blocking failures (exit nonzero) from advisories (warn only); `--json` makes both machine-readable.

## Where to go with an error

1. Read the message literally — paths, routes, and missing files are named.
2. Fix sources, never generated output, then rebuild.
3. Still stuck: [Troubleshooting](../troubleshooting/index.md) (per-failure pages), then [doctor](../cli/doctor.md), then the issue tracker.

Related: [Exit Codes](../cli/exit-codes.md).
