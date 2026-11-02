/**
 * VeTwo design sources (persistent source of truth).
 *
 * The design lives in `<rootDir>/design/` as three user-owned CSS files
 * (`tokens.css`, `base.css`, `components.css`) documented by a README.
 * Builds read these files and emit them verbatim into the generated
 * `globals.css` artifacts of every render target. They are never
 * regenerated or overwritten by ordinary commands — only `docs init`
 * materializes them, strictly create-missing-only.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DESIGN_SOURCE_TEMPLATES, type DesignSourceTemplate } from "./defaults.js";

/** Source files that compose the design system, in canonical load order. */
const CSS_SOURCES = ["design/tokens.css", "design/base.css", "design/components.css"] as const;

/** Banner text for every generated design artifact (marker ownership). */
export const GENERATED_DESIGN_BANNER =
  "/* VeTwo site design — GENERATED FILE.\n" +
  "   Source of truth: <root>/design/tokens.css, design/base.css, design/components.css\n" +
  "   Edits here are discarded on the next build — edit the design sources. */\n";

/** An individual design source file as read for composition. */
export interface DesignSource {
  /** Repository-relative path (`design/tokens.css`, …). */
  readonly path: string;
  /** File contents (real file, or the embedded default when missing). */
  readonly contents: string;
  /** True when the real file was absent and the default was substituted. */
  readonly defaulted: boolean;
}

/**
 * Read the design sources of a workspace. Missing files fall back to the
 * embedded default kit so builds never fail on a partially customized
 * design directory; callers surface the guidance.
 */
export function readDesignSources(rootDir: string): readonly DesignSource[] {
  return CSS_SOURCES.map((path) => {
    const file = resolve(rootDir, path);
    if (existsSync(file)) {
      try {
        return { path, contents: readFileSync(file, "utf8"), defaulted: false };
      } catch {
        return { path, contents: defaultContents(path), defaulted: true };
      }
    }
    return { path, contents: defaultContents(path), defaulted: true };
  });
}

function defaultContents(path: string): string {
  const template = DESIGN_SOURCE_TEMPLATES.find((t) => t.path === path);
  if (template === undefined) throw new Error(`Unknown design source: ${path}`);
  return template.contents;
}

/**
 * Compose the generated shared CSS from design sources (tokens → base →
 * components), wrapped in a generated-file banner.
 */
export function composeDesignCss(sources: readonly DesignSource[]): string {
  return `${GENERATED_DESIGN_BANNER}\n${sources.map((s) => s.contents.trim()).join("\n\n")}\n`;
}

/** Composed design CSS built purely from the embedded default kit. */
export function defaultDesignCss(): string {
  const sources = DESIGN_SOURCE_TEMPLATES.filter((t) => t.path !== "design/README.md").map((t) => ({
    path: t.path,
    contents: defaultContents(t.path),
    defaulted: true,
  }));
  return composeDesignCss(sources);
}

/**
 * Create any missing design source files (and the `design/` directory).
 * Existing files are never replaced — initialization is strictly
 * create-missing-only.
 */
export function ensureDesignSources(rootDir: string): { created: string[]; existing: string[] } {
  const created: string[] = [];
  const existing: string[] = [];
  const designDir = resolve(rootDir, "design");
  if (!existsSync(designDir)) mkdirSync(designDir, { recursive: true });
  for (const template of DESIGN_SOURCE_TEMPLATES) {
    const file = resolve(rootDir, template.path);
    if (existsSync(file)) {
      existing.push(template.path);
      continue;
    }
    writeFileSync(file, template.contents);
    created.push(template.path);
  }
  return { created, existing };
}

/** Renderer theme values that map onto design tokens (optional overrides). */
export interface DesignThemeOverrides {
  readonly colors?: Partial<Record<string, string>>;
  readonly fonts?: Partial<Record<string, string>>;
}

/**
 * Traditional docs.config.ts theme values applied as an override layer
 * after the design sources (later rules win at equal specificity). The
 * override is emitted for both scheme selectors so an explicit theme
 * color pins it across light and dark.
 */
export function themeOverrideCss(theme: DesignThemeOverrides | undefined): string {
  if (theme === undefined) return "";
  const declarations: string[] = [];
  const colors = theme.colors ?? {};
  const accent = colors["accent"] ?? colors["primary"];
  if (accent !== undefined) declarations.push(`--vetwo-accent: ${accent};`);
  if (colors["secondary"] !== undefined)
    declarations.push(`--vetwo-secondary: ${colors["secondary"]};`);
  if (colors["background"] !== undefined) declarations.push(`--vetwo-bg: ${colors["background"]};`);
  if (colors["surface"] !== undefined) declarations.push(`--vetwo-surface: ${colors["surface"]};`);
  if (colors["text"] !== undefined) declarations.push(`--vetwo-fg: ${colors["text"]};`);
  if (colors["muted"] !== undefined) declarations.push(`--vetwo-muted: ${colors["muted"]};`);
  const fonts = theme.fonts ?? {};
  if (fonts["body"] !== undefined) declarations.push(`--vetwo-font-body: ${fonts["body"]};`);
  if (fonts["heading"] !== undefined)
    declarations.push(`--vetwo-font-heading: ${fonts["heading"]};`);
  if (fonts["code"] !== undefined) declarations.push(`--vetwo-font-code: ${fonts["code"]};`);
  if (declarations.length === 0) return "";
  const body = declarations.map((d) => `  ${d}`).join("\n");
  return `/* Explicit theme overrides (docs.config.ts theme) — pin across schemes. */\n:root,\n.dark {\n${body}\n}\n\n@media (prefers-color-scheme: dark) {\n  :root:not(.dark) {\n${body}\n  }\n}\n`;
}

export { DESIGN_SOURCE_TEMPLATES };
export type { DesignSourceTemplate };
