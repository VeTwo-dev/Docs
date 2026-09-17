import type { Theme } from "../../themes/types.js";
import {
  resolveTheme,
  mergeTheme,
  generateThemeCSS,
  generateStylesheet,
} from "../../themes/registry.js";
import type { ServiceFactory } from "../container.js";

/**
 * Theme service — resolves themes and generates stylesheets.
 *
 * Wraps the existing theme registry so engine consumers depend on the
 * service rather than concrete theme helpers.
 */
export interface ThemeService {
  readonly resolve: (theme: string | Theme) => Theme;
  readonly merge: (base: Theme, overrides: Partial<Theme>) => Theme;
  readonly generateCSS: (theme: Theme) => string;
  readonly generateStylesheet: (theme: Theme) => string;
}

export const THEME_SERVICE = "theme";

export const themeServiceFactory: ServiceFactory<ThemeService> = () => ({
  resolve: (theme) => resolveTheme(theme),
  merge: (base, overrides) => mergeTheme(base, overrides),
  generateCSS: (theme) => generateThemeCSS(theme),
  generateStylesheet: (theme) => generateStylesheet(theme),
});
