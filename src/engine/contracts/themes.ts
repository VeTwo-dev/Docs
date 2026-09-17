import type { Theme, ThemeInput } from "../../themes/types.js";

/**
 * Internal engine contract for theme resolution and stylesheet generation.
 */
export interface ThemeProviderContract {
  readonly resolve: (theme: string | Theme) => Theme;
  readonly generateCSS: (theme: Theme) => string;
  readonly generateStylesheet: (theme: Theme) => string;
  readonly merge: (base: Theme, input?: ThemeInput) => Theme;
}
