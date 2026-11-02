# Ownership and Safety Failures

- **Stale files linger after deleting sources**: reconciliation only removes files the *previous* manifest proves generator-owned. Foreign manifests, hand-placed files, and files outside the five target roots are preserved by design — remove those by hand if they are truly yours to remove.
- **A generated file you edited got overwritten**: expected — inventoried files refresh every build. Move your content into authored sources (or user-owned paths) instead.
- **`docs clean` refuses ("outside the project root")**: the configured output resolves outside the project. Point it inside, or pass an explicit in-project path. Preview with `--dry-run`.
- **`docs clean` didn't remove something**: it only targets the output dir plus *registered* `.vetwo/docs/` namespaces — manifests, workspace files, and unknown directories are never candidates.
- **Two checkouts sharing one output directory**: don't. Ownership is per-workspace; interleaved builds from different sources produce reconcile churn, not corruption (unknown files still survive), but keep one workspace per output.
