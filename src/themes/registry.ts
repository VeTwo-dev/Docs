import type { Theme, ThemeColors, ThemeFonts, ThemeSpacing } from "./types.js";
import { BUILT_IN_THEMES } from "./built-in.js";

/**
 * Merges a partial theme input onto a base theme, returning a new theme
 * with all fields resolved.
 *
 * @param base - The base theme to extend.
 * @param overrides - Partial overrides to apply.
 * @returns A new fully-resolved theme.
 */
export function mergeTheme(base: Theme, overrides: Partial<Theme>): Theme {
  return {
    ...base,
    name: overrides.name ?? base.name,
    label: overrides.label ?? base.label,
    light: { ...base.light, ...(overrides.light ?? {}) },
    dark: { ...base.dark, ...(overrides.dark ?? {}) },
    fonts: { ...base.fonts, ...(overrides.fonts ?? {}) },
    spacing: { ...base.spacing, ...(overrides.spacing ?? {}) },
  };
}

/**
 * Resolves a theme by name from the built-in registry, or returns the
 * provided theme object if it's already a Theme instance.
 *
 * @param theme - A theme name string or a Theme object.
 * @returns The resolved Theme.
 * @throws If a string name is provided that doesn't match any built-in theme.
 */
export function resolveTheme(theme: string | Theme): Theme {
  if (typeof theme === "string") {
    const builtIn = BUILT_IN_THEMES.get(theme);
    if (!builtIn) {
      throw new Error(
        `Unknown theme "${theme}". Available themes: ${[...BUILT_IN_THEMES.keys()].join(", ")}`,
      );
    }
    return builtIn;
  }
  return theme;
}

function colorVars(colors: ThemeColors, prefix: string): string {
  return Object.entries(colors)
    .map(([key, value]) => {
      const cssVar = key.replace(/([A-Z])/g, "-$1").toLowerCase();
      return `  --${prefix}-${cssVar}: ${value};`;
    })
    .join("\n");
}

function fontVars(fonts: ThemeFonts): string {
  return `  --font-body: ${fonts.body};
  --font-heading: ${fonts.heading};
  --font-code: ${fonts.code};
  --font-body-size: ${fonts.bodySize};
  --font-heading-weight: ${fonts.headingWeight};
  --line-height: ${fonts.lineHeight};`;
}

function spacingVars(spacing: ThemeSpacing): string {
  return `  --content-max-width: ${spacing.contentMaxWidth};
  --sidebar-width: ${spacing.sidebarWidth};
  --header-height: ${spacing.headerHeight};
  --content-padding: ${spacing.contentPadding};
  --border-radius: ${spacing.borderRadius};`;
}

/**
 * Generates a CSS string from a theme, using CSS custom properties
 * with light/dark mode media queries.
 *
 * @param theme - The theme to generate CSS for.
 * @returns A CSS string with custom properties and base styles.
 */
export function generateThemeCSS(theme: Theme): string {
  return `:root {
${colorVars(theme.light, "light")}
${colorVars(theme.dark, "dark")}
${fontVars(theme.fonts)}
${spacingVars(theme.spacing)}

  color-scheme: light dark;
  color: var(--light-text);
  background-color: var(--light-background);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color: var(--dark-text);
    background-color: var(--dark-background);
  }
}

:root[data-theme="dark"] {
  color: var(--dark-text);
  background-color: var(--dark-background);
}

:root[data-theme="light"] {
  color: var(--light-text);
  background-color: var(--light-background);
}`;
}

/**
 * Generates the full base stylesheet including theme variables,
 * reset, and component styles.
 *
 * @param theme - The theme to generate the stylesheet for.
 * @returns A complete CSS stylesheet string.
 */
export function generateStylesheet(theme: Theme): string {
  const vars = generateThemeCSS(theme);

  return `${vars}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-body);
  font-size: var(--font-body-size);
  line-height: var(--line-height);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

a {
  color: var(--light-primary);
  text-decoration: none;
}

a:hover {
  color: var(--light-primary-hover);
  text-decoration: underline;
}

code {
  font-family: var(--font-code);
  background: var(--light-code-bg);
  color: var(--light-code);
  padding: 0.15em 0.4em;
  border-radius: var(--border-radius);
  font-size: 0.9em;
  border: 1px solid var(--light-code-border);
}

pre {
  background: var(--light-surface);
  border: 1px solid var(--light-border);
  padding: 1rem;
  border-radius: var(--border-radius);
  overflow-x: auto;
  margin-bottom: 1.5rem;
}

pre code {
  background: none;
  padding: 0;
  border: none;
  color: inherit;
}

blockquote {
  border-left: 4px solid var(--light-primary);
  padding-left: 1rem;
  margin: 1.5rem 0;
  color: var(--light-text-muted);
}

table {
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 1.5rem;
}

th, td {
  border: 1px solid var(--light-border);
  padding: 0.5rem 0.75rem;
  text-align: left;
}

th {
  background: var(--light-surface);
  font-weight: 600;
}

img {
  max-width: 100%;
  height: auto;
}

hr {
  border: none;
  border-top: 1px solid var(--light-border);
  margin: 2rem 0;
}

.callout {
  padding: 1rem 1.25rem;
  border-radius: var(--border-radius);
  margin: 1.5rem 0;
  border-left: 4px solid;
  background: var(--light-surface);
}

.callout-info { border-color: var(--light-callout-info); }
.callout-warning { border-color: var(--light-callout-warning); }
.callout-error { border-color: var(--light-callout-error); }
.callout-success { border-color: var(--light-callout-success); }

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) a { color: var(--dark-primary); }
  :root:not([data-theme="light"]) a:hover { color: var(--dark-primary-hover); }
  :root:not([data-theme="light"]) code { background: var(--dark-code-bg); color: var(--dark-code); border-color: var(--dark-code-border); }
  :root:not([data-theme="light"]) pre { background: var(--dark-surface); border-color: var(--dark-border); }
  :root:not([data-theme="light"]) blockquote { border-color: var(--dark-primary); color: var(--dark-text-muted); }
  :root:not([data-theme="light"]) th { background: var(--dark-surface); }
  :root:not([data-theme="light"]) th, :root:not([data-theme="light"]) td { border-color: var(--dark-border); }
  :root:not([data-theme="light"]) .callout { background: var(--dark-surface); }
}

:root[data-theme="dark"] a { color: var(--dark-primary); }
:root[data-theme="dark"] a:hover { color: var(--dark-primary-hover); }
:root[data-theme="dark"] code { background: var(--dark-code-bg); color: var(--dark-code); border-color: var(--dark-code-border); }
:root[data-theme="dark"] pre { background: var(--dark-surface); border-color: var(--dark-border); }
:root[data-theme="dark"] blockquote { border-color: var(--dark-primary); color: var(--dark-text-muted); }
:root[data-theme="dark"] th { background: var(--dark-surface); }
:root[data-theme="dark"] th, :root[data-theme="dark"] td { border-color: var(--dark-border); }
:root[data-theme="dark"] .callout { background: var(--dark-surface); }

.site-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--light-header-bg);
  border-bottom: 1px solid var(--light-header-border);
  height: var(--header-height);
}

.header-inner {
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: 0 var(--content-padding);
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 2rem;
}

.header-brand {
  font-weight: 700;
  font-size: 1.125rem;
  color: var(--light-header-text);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
}

.header-logo {
  height: 28px;
  width: auto;
}

.header-nav {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.header-nav a {
  color: var(--light-text-muted);
  font-size: 0.9rem;
  font-weight: 500;
  text-decoration: none;
}

.header-nav a:hover {
  color: var(--light-text);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.theme-toggle {
  background: none;
  border: 1px solid var(--light-border);
  border-radius: var(--border-radius);
  padding: 0.4rem;
  cursor: pointer;
  color: var(--light-text);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}

.theme-toggle:hover {
  background: var(--light-surface);
}

.icon-moon { display: none; }
.icon-sun { display: block; }

:root[data-theme="dark"] .icon-moon { display: block; }
:root[data-theme="dark"] .icon-sun { display: none; }

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .icon-moon { display: block; }
  :root:not([data-theme="light"]) .icon-sun { display: none; }
}

.layout {
  display: flex;
  max-width: var(--content-max-width);
  margin: 0 auto;
  min-height: calc(100vh - var(--header-height));
}

.sidebar {
  width: var(--sidebar-width);
  flex-shrink: 0;
  padding: var(--content-padding);
  border-right: 1px solid var(--light-border);
  background: var(--light-sidebar-bg);
  position: sticky;
  top: var(--header-height);
  height: calc(100vh - var(--header-height));
  overflow-y: auto;
}

.sidebar-group {
  margin-bottom: 1.5rem;
}

.sidebar-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--light-text-muted);
  margin-bottom: 0.5rem;
}

.sidebar-list {
  list-style: none;
}

.sidebar-list a {
  display: block;
  padding: 0.3rem 0.75rem;
  color: var(--light-sidebar-text);
  text-decoration: none;
  border-radius: var(--border-radius);
  font-size: 0.9rem;
}

.sidebar-list a:hover {
  background: var(--light-surface);
  color: var(--light-sidebar-active);
  text-decoration: none;
}

.content {
  flex: 1;
  min-width: 0;
  padding: var(--content-padding);
  max-width: 48rem;
}

.content h1 {
  font-size: 2rem;
  font-weight: var(--font-heading-weight);
  margin-bottom: 1rem;
  line-height: 1.2;
}

.content h2 {
  font-size: 1.5rem;
  font-weight: var(--font-heading-weight);
  margin-top: 2.5rem;
  margin-bottom: 0.75rem;
}

.content h3 {
  font-size: 1.25rem;
  font-weight: var(--font-heading-weight);
  margin-top: 2rem;
  margin-bottom: 0.5rem;
}

.content p {
  margin-bottom: 1rem;
}

.content ul, .content ol {
  margin-bottom: 1rem;
  padding-left: 1.5rem;
}

.content li {
  margin-bottom: 0.25rem;
}

.site-footer {
  border-top: 1px solid var(--light-border);
  padding: 1.5rem var(--content-padding);
  text-align: center;
  color: var(--light-text-muted);
  font-size: 0.875rem;
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.site-footer a {
  color: var(--light-text-muted);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .site-header { background: var(--dark-header-bg); border-color: var(--dark-header-border); }
  :root:not([data-theme="light"]) .header-brand { color: var(--dark-header-text); }
  :root:not([data-theme="light"]) .header-nav a { color: var(--dark-text-muted); }
  :root:not([data-theme="light"]) .header-nav a:hover { color: var(--dark-text); }
  :root:not([data-theme="light"]) .theme-toggle { border-color: var(--dark-border); color: var(--dark-text); }
  :root:not([data-theme="light"]) .theme-toggle:hover { background: var(--dark-surface); }
  :root:not([data-theme="light"]) .sidebar { border-color: var(--dark-border); background: var(--dark-sidebar-bg); }
  :root:not([data-theme="light"]) .sidebar-title { color: var(--dark-text-muted); }
  :root:not([data-theme="light"]) .sidebar-list a { color: var(--dark-sidebar-text); }
  :root:not([data-theme="light"]) .sidebar-list a:hover { background: var(--dark-surface); color: var(--dark-sidebar-active); }
  :root:not([data-theme="light"]) .site-footer { border-color: var(--dark-border); color: var(--dark-text-muted); }
}

:root[data-theme="dark"] .site-header { background: var(--dark-header-bg); border-color: var(--dark-header-border); }
:root[data-theme="dark"] .header-brand { color: var(--dark-header-text); }
:root[data-theme="dark"] .header-nav a { color: var(--dark-text-muted); }
:root[data-theme="dark"] .header-nav a:hover { color: var(--dark-text); }
:root[data-theme="dark"] .theme-toggle { border-color: var(--dark-border); color: var(--dark-text); }
:root[data-theme="dark"] .theme-toggle:hover { background: var(--dark-surface); }
:root[data-theme="dark"] .sidebar { border-color: var(--dark-border); background: var(--dark-sidebar-bg); }
:root[data-theme="dark"] .sidebar-title { color: var(--dark-text-muted); }
:root[data-theme="dark"] .sidebar-list a { color: var(--dark-sidebar-text); }
:root[data-theme="dark"] .sidebar-list a:hover { background: var(--dark-surface); color: var(--dark-sidebar-active); }
:root[data-theme="dark"] .site-footer { border-color: var(--dark-border); color: var(--dark-text-muted); }

.toc {
  margin-bottom: 2rem;
  padding: 1rem 1.25rem;
  background: var(--light-surface);
  border: 1px solid var(--light-border);
  border-radius: var(--border-radius);
}

.toc h2 {
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--light-text-muted);
  margin-bottom: 0.75rem;
}

.toc ul {
  list-style: none;
  padding-left: 0;
}

.toc ul ul {
  padding-left: 1.25rem;
}

.toc li {
  margin-bottom: 0.25rem;
}

.toc a {
  font-size: 0.9rem;
  color: var(--light-text-muted);
  text-decoration: none;
}

.toc a:hover {
  color: var(--light-primary);
  text-decoration: none;
}

.prev-next-nav {
  display: flex;
  justify-content: space-between;
  margin-top: 3rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--light-border);
  gap: 1rem;
}

.prev-link, .next-link {
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 1rem;
  border: 1px solid var(--light-border);
  border-radius: var(--border-radius);
  text-decoration: none;
  color: var(--light-text);
  font-size: 0.9rem;
  transition: border-color 0.15s, background 0.15s;
}

.prev-link:hover, .next-link:hover {
  border-color: var(--light-primary);
  background: var(--light-surface);
  text-decoration: none;
}

.next-link {
  margin-left: auto;
}

.search-wrapper {
  display: flex;
  align-items: center;
}

.search-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--border-radius);
  color: var(--light-text-muted);
  transition: background 0.15s;
}

.search-link:hover {
  background: var(--light-surface);
  color: var(--light-text);
  text-decoration: none;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .toc { background: var(--dark-surface); border-color: var(--dark-border); }
  :root:not([data-theme="light"]) .toc h2 { color: var(--dark-text-muted); }
  :root:not([data-theme="light"]) .toc a { color: var(--dark-text-muted); }
  :root:not([data-theme="light"]) .toc a:hover { color: var(--dark-primary); }
  :root:not([data-theme="light"]) .prev-next-nav { border-color: var(--dark-border); }
  :root:not([data-theme="light"]) .prev-link, :root:not([data-theme="light"]) .next-link { border-color: var(--dark-border); color: var(--dark-text); }
  :root:not([data-theme="light"]) .prev-link:hover, :root:not([data-theme="light"]) .next-link:hover { border-color: var(--dark-primary); background: var(--dark-surface); }
  :root:not([data-theme="light"]) .search-link { color: var(--dark-text-muted); }
  :root:not([data-theme="light"]) .search-link:hover { background: var(--dark-surface); color: var(--dark-text); }
}

:root[data-theme="dark"] .toc { background: var(--dark-surface); border-color: var(--dark-border); }
:root[data-theme="dark"] .toc h2 { color: var(--dark-text-muted); }
:root[data-theme="dark"] .toc a { color: var(--dark-text-muted); }
:root[data-theme="dark"] .toc a:hover { color: var(--dark-primary); }
:root[data-theme="dark"] .prev-next-nav { border-color: var(--dark-border); }
:root[data-theme="dark"] .prev-link, :root[data-theme="dark"] .next-link { border-color: var(--dark-border); color: var(--dark-text); }
:root[data-theme="dark"] .prev-link:hover, :root[data-theme="dark"] .next-link:hover { border-color: var(--dark-primary); background: var(--dark-surface); }
:root[data-theme="dark"] .search-link { color: var(--dark-text-muted); }
:root[data-theme="dark"] .search-link:hover { background: var(--dark-surface); color: var(--dark-text); }`;
}
