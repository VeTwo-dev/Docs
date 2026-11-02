# Design System

The visual identity — color, typography, spacing, motion, component styling — lives in a **persistent, user-owned design directory** that every render target consumes at build time. The design is never regenerated or overwritten: it is created once by `docs init` (create-missing-only) and is yours to edit thereafter.

## Sources

All design decisions live in `<root>/design/`:

- `tokens.css` — the single definition of every semantic design token (surfaces, ink, accents, status tones, fonts, spacing scale, radii, motion, layers). The VeTwo identity is defined here: cinematic near-black surfaces with a restrained emerald accent; a light palette is included and selected by `prefers-color-scheme` (or the explicit `.dark` toggle in the Fumadocs target).
- `base.css` — document baseline: page defaults, focus ring, selection wash, scrollbars, reduced-motion handling, and article typography scoped with `:where()` so it never fights stronger rules.
- `components.css` — every `.vetwo-*` component class emitted by the renderers (header, sidebar, article, callouts, tables, search page, footer), one definition each.

## Emission contract

Every build re-composes the emitted CSS from the design sources, in order:

1. `tokens.css` — scheme-aware custom properties
2. `base.css` — baseline styles
3. `components.css` — component styles
4. `theme` config values from `docs.config.ts` — an explicit override layer pinned on top (emitted for both scheme selectors, so a config color pins across light and dark)

The composed result is written to the generated artifacts — `app/globals.css` in the Fumadocs (`site/`) target and `assets/css/globals.css` in the static target, both marked with a generated-file banner. Edits to those artifacts are discarded on the next build; edit the sources instead.

## Ownership

The design directory is user-authored content with one-time initialization: `docs init` writes only files that are missing and leaves existing files untouched, and ordinary builds (`docs build`, `docs dev`, renderers) only read it. Missing individual files fall back to the embedded default kit, so a partially customized directory still builds; the build log names the fallback.

## Fumadocs adaptation

The Fumadocs target keeps its imports and maps Fumadocs' `--color-fd-*` variables onto the design tokens (`--color-fd-primary: var(--vetwo-accent)`, `--color-fd-background: var(--vetwo-bg)`, …) once; custom-property indirection means the explicit `.dark` toggle and OS dark mode both resolve through the same token values.

To evolve the design kit itself, edit `design/*.css` directly. The embedded defaults (used for `docs init` in new projects) are regenerated with `node scripts/embed-design-defaults.mjs`.

Related: [Rendering and Targets](rendering-targets.md), [Ownership and Reconciliation](ownership-reconciliation.md).
