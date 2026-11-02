# Known Limitations

Confirmed boundaries — not a roadmap, not a bug list for someone else to reinterpret.

1. **No symlinks-aware containment.** All path checks are lexical. A symlink inside an allowed root pointing outside it is neither detected nor blocked.
2. **Static search needs HTTP(S).** The search page `fetch`es its records; it does not work from `file://`.
3. **Reserved config keys do nothing.** `watch`, `clean`, `include`, `remarkPlugins`, `rehypePlugins` are accepted and defaulted but unread at runtime. Use the CLI equivalents.
4. **Fumadocs/Next.js apps are yours to run.** The generator emits the project (with a complete pinned manifest) but never installs, builds, or deploys it.
5. **No hosted anything.** No preview service, no CMS, no deployment target, no AI generation at runtime.
6. **Duplicate build work.** `engine.build` runs legacy pipeline stages plus canonical materialization — deterministic and bounded, but redundant. Unification awaits the same future decision as the legacy surface.
7. **Search-index copies are overwrite-deterministic but uninventoried.** The root and `next/public` search indexes are rewritten every build yet excluded from the manifest inventory, so disabling layouts later can leave a stale copy behind (it never touches user files).
8. **Single-home static contract.** A content set with no home page fails `static` validation rather than synthesizing an entry point.
9. **Tests cannot run without sources.** The suite lives in `src/`; distribution consumers validate via the published artifacts and the CLI, not via the test suite.
