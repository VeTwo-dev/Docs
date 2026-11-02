/**
 * Shared VeTwo design tokens (Phase 8).
 *
 * Single source of truth for the documentation color + typography system
 * consumed by both the Next.js/Fumadocs globals and the static stylesheet
 * (which reuses the Next.js emitter). Values match the established palette;
 * CSS custom properties let deployments override without template edits.
 * Restrained by design: no gradients, no animations, no decorative tokens.
 */

import type { RendererTheme } from "./types.js";

/** Resolved light-theme token values (var name → CSS value). */
export function vetwoLightTokens(theme?: RendererTheme): Record<string, string> {
  const colors = theme?.colors ?? {};
  const fonts = theme?.fonts ?? {};
  const bodyFont = fonts.body ?? 'system-ui, -apple-system, "Segoe UI", sans-serif';
  return {
    "--vetwo-bg": colors.background ?? "#ffffff",
    "--vetwo-fg": colors.text ?? "#111827",
    "--vetwo-muted": colors.muted ?? "#6b7280",
    "--vetwo-border": "#e5e7eb",
    "--vetwo-accent": colors.accent ?? colors.primary ?? "#2563eb",
    "--vetwo-primary": colors.primary ?? "#2563eb",
    "--vetwo-secondary": colors.secondary ?? "#7c3aed",
    "--vetwo-surface": colors.surface ?? "#f9fafb",
    "--vetwo-sidebar-bg": colors.surface ?? "#f9fafb",
    "--vetwo-code-bg": "#f3f4f6",
    "--vetwo-font-body": bodyFont,
    "--vetwo-font-heading": fonts.heading ?? bodyFont,
    "--vetwo-font-code": fonts.code ?? "ui-monospace, SFMono-Regular, Menlo, monospace",
  };
}

/** Dark-theme overrides (same keys; structural colors stay fixed). */
export function vetwoDarkTokens(): Record<string, string> {
  return {
    "--vetwo-bg": "#0b0f17",
    "--vetwo-fg": "#e5e7eb",
    "--vetwo-muted": "#9ca3af",
    "--vetwo-border": "#1f2937",
    "--vetwo-accent": "#60a5fa",
    "--vetwo-sidebar-bg": "#0f1420",
    "--vetwo-code-bg": "#111827",
  };
}

/** Render a token map as a CSS rule body (sorted for determinism). */
export function tokensCssBody(tokens: Record<string, string>): string {
  return Object.keys(tokens)
    .sort()
    .map((name) => `  ${name}: ${tokens[name]};`)
    .join("\n");
}
