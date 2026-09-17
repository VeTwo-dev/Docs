import type { Theme } from "./types.js";

const defaultColors = {
  background: "#ffffff",
  surface: "#f9fafb",
  text: "#111827",
  textMuted: "#6b7280",
  primary: "#2563eb",
  primaryHover: "#1d4ed8",
  border: "#e5e7eb",
  code: "#d63384",
  codeBg: "#f3f4f6",
  codeBorder: "#e5e7eb",
  sidebarBg: "#f9fafb",
  sidebarText: "#374151",
  sidebarActive: "#2563eb",
  headerBg: "#ffffff",
  headerBorder: "#e5e7eb",
  headerText: "#111827",
  calloutInfo: "#3b82f6",
  calloutWarning: "#f59e0b",
  calloutError: "#ef4444",
  calloutSuccess: "#10b981",
} as const;

const defaultDarkColors = {
  background: "#0f172a",
  surface: "#1e293b",
  text: "#e2e8f0",
  textMuted: "#94a3b8",
  primary: "#60a5fa",
  primaryHover: "#93bbfd",
  border: "#334155",
  code: "#f472b6",
  codeBg: "#1e293b",
  codeBorder: "#334155",
  sidebarBg: "#1e293b",
  sidebarText: "#cbd5e1",
  sidebarActive: "#60a5fa",
  headerBg: "#0f172a",
  headerBorder: "#334155",
  headerText: "#e2e8f0",
  calloutInfo: "#60a5fa",
  calloutWarning: "#fbbf24",
  calloutError: "#f87171",
  calloutSuccess: "#34d399",
} as const;

/** Default theme with blue accents and clean typography. */
export const defaultTheme: Theme = {
  name: "default",
  label: "Default",
  light: defaultColors,
  dark: defaultDarkColors,
  fonts: {
    body: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
    heading: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
    code: '"JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
    bodySize: "16px",
    headingWeight: "700",
    lineHeight: "1.7",
  },
  spacing: {
    contentMaxWidth: "72rem",
    sidebarWidth: "260px",
    headerHeight: "64px",
    contentPadding: "2rem",
    borderRadius: "8px",
  },
};

const midnightColors = {
  background: "#000000",
  surface: "#111111",
  text: "#e4e4e7",
  textMuted: "#a1a1aa",
  primary: "#a78bfa",
  primaryHover: "#c4b5fd",
  border: "#27272a",
  code: "#f472b6",
  codeBg: "#18181b",
  codeBorder: "#27272a",
  sidebarBg: "#09090b",
  sidebarText: "#a1a1aa",
  sidebarActive: "#a78bfa",
  headerBg: "#000000",
  headerBorder: "#27272a",
  headerText: "#e4e4e7",
  calloutInfo: "#818cf8",
  calloutWarning: "#fbbf24",
  calloutError: "#fb7185",
  calloutSuccess: "#34d399",
} as const;

const midnightDarkColors = {
  ...midnightColors,
  background: "#000000",
  surface: "#0a0a0a",
} as const;

/** Midnight theme with purple accents and deep black background. */
export const midnightTheme: Theme = {
  name: "midnight",
  label: "Midnight",
  light: midnightColors,
  dark: midnightDarkColors,
  fonts: {
    body: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
    heading: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
    code: '"JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
    bodySize: "16px",
    headingWeight: "700",
    lineHeight: "1.7",
  },
  spacing: {
    contentMaxWidth: "72rem",
    sidebarWidth: "260px",
    headerHeight: "64px",
    contentPadding: "2rem",
    borderRadius: "8px",
  },
};

const greenAccentColors = {
  ...defaultColors,
  primary: "#059669",
  primaryHover: "#047857",
  sidebarActive: "#059669",
  code: "#059669",
  calloutInfo: "#3b82f6",
  calloutWarning: "#f59e0b",
  calloutError: "#ef4444",
  calloutSuccess: "#059669",
} as const;

const greenAccentDarkColors = {
  ...defaultDarkColors,
  primary: "#34d399",
  primaryHover: "#6ee7b7",
  sidebarActive: "#34d399",
  code: "#34d399",
  calloutInfo: "#60a5fa",
  calloutWarning: "#fbbf24",
  calloutError: "#f87171",
  calloutSuccess: "#34d399",
} as const;

/** Forest theme with green accents. */
export const forestTheme: Theme = {
  name: "forest",
  label: "Forest",
  light: greenAccentColors,
  dark: greenAccentDarkColors,
  fonts: {
    body: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
    heading: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
    code: '"JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
    bodySize: "16px",
    headingWeight: "700",
    lineHeight: "1.7",
  },
  spacing: {
    contentMaxWidth: "72rem",
    sidebarWidth: "260px",
    headerHeight: "64px",
    contentPadding: "2rem",
    borderRadius: "8px",
  },
};

/** All built-in themes indexed by name. */
export const BUILT_IN_THEMES: ReadonlyMap<string, Theme> = new Map([
  ["default", defaultTheme],
  ["midnight", midnightTheme],
  ["forest", forestTheme],
]);
