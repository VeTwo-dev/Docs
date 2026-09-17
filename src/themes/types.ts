/** Color palette for a single theme mode. */
export interface ThemeColors {
  readonly background: string;
  readonly surface: string;
  readonly text: string;
  readonly textMuted: string;
  readonly primary: string;
  readonly primaryHover: string;
  readonly border: string;
  readonly code: string;
  readonly codeBg: string;
  readonly codeBorder: string;
  readonly sidebarBg: string;
  readonly sidebarText: string;
  readonly sidebarActive: string;
  readonly headerBg: string;
  readonly headerBorder: string;
  readonly headerText: string;
  readonly calloutInfo: string;
  readonly calloutWarning: string;
  readonly calloutError: string;
  readonly calloutSuccess: string;
}

/** Font configuration for a theme. */
export interface ThemeFonts {
  readonly body: string;
  readonly heading: string;
  readonly code: string;
  readonly bodySize: string;
  readonly headingWeight: string;
  readonly lineHeight: string;
}

/** Spacing and layout configuration. */
export interface ThemeSpacing {
  readonly contentMaxWidth: string;
  readonly sidebarWidth: string;
  readonly headerHeight: string;
  readonly contentPadding: string;
  readonly borderRadius: string;
}

/** A fully defined theme with light/dark mode colors. */
export interface Theme {
  readonly name: string;
  readonly label: string;
  readonly light: ThemeColors;
  readonly dark: ThemeColors;
  readonly fonts: ThemeFonts;
  readonly spacing: ThemeSpacing;
}

/** Partial user input for creating a theme override. */
export interface ThemeInput {
  readonly name?: string;
  readonly label?: string;
  readonly light?: Partial<ThemeColors>;
  readonly dark?: Partial<ThemeColors>;
  readonly fonts?: Partial<ThemeFonts>;
  readonly spacing?: Partial<ThemeSpacing>;
}
