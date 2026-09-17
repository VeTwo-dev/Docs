/**
 * Escapes special HTML characters in a string to prevent XSS.
 *
 * @param text - The raw string to escape.
 * @returns The escaped string safe for HTML embedding.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Escapes a string for safe insertion into a URL attribute (e.g., `src`, `href`).
 * Prevents attribute injection attacks like `onerror="..."`.
 *
 * @param url - The raw URL string.
 * @returns The escaped URL safe for HTML attribute embedding.
 */
export function escapeUrlAttr(url: string): string {
  return url
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
