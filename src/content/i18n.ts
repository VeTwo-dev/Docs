/**
 * Content Internationalization.
 *
 * Tracks localized content, translation ownership, and stale-translation
 * detection via source fingerprints. Never overwrites translations.
 */

import type { DocumentationDiagnostic } from "../documentation/compiler/diagnostics.js";
import { diagnostic } from "../documentation/compiler/diagnostics.js";
import type { TranslationOwnership } from "./types.js";

/** One localized variant of a page. */
export interface LocalizedPage {
  readonly slug: string;
  readonly locale: string;
  /** Fingerprint of the source-language page this was translated from. */
  readonly sourceFingerprint: string;
  /** Current fingerprint of the source-language page. */
  readonly currentSourceFingerprint?: string;
  readonly ownership: TranslationOwnership;
}

/**
 * Determine whether a localization is stale: the source page's content
 * changed after the translation was produced.
 */
export function isTranslationStale(page: LocalizedPage): boolean {
  if (page.currentSourceFingerprint === undefined) return false;
  return page.sourceFingerprint !== page.currentSourceFingerprint;
}

/** Diagnostics for a set of localizations. */
export function translationDiagnostics(pages: readonly LocalizedPage[]): DocumentationDiagnostic[] {
  const diagnostics: DocumentationDiagnostic[] = [];
  for (const page of pages) {
    if (isTranslationStale(page)) {
      diagnostics.push(
        diagnostic(
          "DOC_STALE_TRANSLATION",
          "warning",
          `The ${page.locale} translation of "${page.slug}" may be stale (source changed).`,
          page.slug,
          "Review and update the translation; it will not be overwritten automatically.",
        ),
      );
    }
  }
  return diagnostics;
}

/** Default locale for source-authored content. */
export const DEFAULT_LOCALE = "en";

/** Detect the locale of a content path like `content/ar/guides/x.mdx`. */
export function localeOfPath(
  path: string,
  knownLocales: readonly string[] = [DEFAULT_LOCALE],
): string {
  const segments = path.split("/");
  for (const segment of segments) {
    if (knownLocales.includes(segment)) return segment;
  }
  return DEFAULT_LOCALE;
}
