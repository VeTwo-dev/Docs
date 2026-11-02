# VeTwo Design System

This directory is the **persistent design source of truth** for all rendered
documentation sites (`docs/site` Fumadocs target and `docs/static` portable
target). It owns the visual identity: color, typography, spacing, motion, and
component styling.

## Files

| File               | Owns                                                                  |
| ------------------ | --------------------------------------------------------------------- |
| `tokens.css`       | Semantic design tokens (color, type, spacing, radius, motion, shadow) |
| `base.css`         | Document baseline: resets, page defaults, focus, selection, scrollbars|
| `components.css`   | All `.vetwo-*` component styles shared by both render targets         |

## Ownership contract

- These files are **user-owned design sources**. They are created once by
  `docs init` (or on first use) and are **never regenerated or overwritten**.
  Edit them freely; every build re-reads them from disk.
- Emitted artifacts — `app/globals.css` in the Next.js/Fumadocs output and
  `assets/css/globals.css` in the static output — are **generated** from these
  sources on every build. Never edit the emitted files: the build discards
  those changes.
- Token overrides can also be supplied declaratively through the `theme`
  object in `docs.config.ts`. Config values are appended after the design
  sources, so explicit config clones the design sources in specificity and
  order, and its values win.
- Single source of truth: **one semantic token, one definition**. Define every
  token in `tokens.css` only; define every class in `components.css` only.
  Document new tokens at the top of `tokens.css` so future authors can see
  the full vocabulary without reading the file.

## Theming

`tokens.css` defines a light palette on `:root` and a dark palette for
`.dark` (Fumadocs/`next-themes` explicit toggling) and for
`@media (prefers-color-scheme: dark)` (static target can rely on the OS
setting; this rule skips any document pinned by `.dark`).

The identity: cinematic near-black surfaces, restrained emerald accents used
only for interactive elements, status colors kept to a compact set.
