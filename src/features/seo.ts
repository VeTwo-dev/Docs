import type { SitemapEntry } from "../types/public.js";
import type { BuildContextMutable } from "../types/internal.js";
import { writeFile } from "../filesystem/index.js";
import { join } from "node:path";

/**
 * Generates sitemap entries from the pages in the build context.
 *
 * @param ctx - The mutable build context containing pages.
 *
 * @example
 * ```ts
 * generateSitemap(ctx);
 * ```
 */
export function generateSitemap(ctx: BuildContextMutable): void {
  if (!ctx.config.sitemap) return;

  const baseUrl = ctx.config.baseUrl.replace(/\/+$/, "");
  const entries: SitemapEntry[] = ctx.pages.map((page) => ({
    url: `${baseUrl}${page.slug}`,
    lastModified: page.lastModified,
    changeFrequency: "weekly" as const,
    priority: page.category === "guides" ? 0.8 : page.slug === "/" ? 1.0 : 0.6,
  }));

  (ctx as { sitemapEntries: SitemapEntry[] }).sitemapEntries = entries;
}

/**
 * Writes the generated sitemap to the output directory as an XML file
 * using the `sitemap` library for proper sitemap.xml generation.
 *
 * @param ctx - The mutable build context containing sitemap entries.
 *
 * @example
 * ```ts
 * writeSitemap(ctx);
 * ```
 */
export async function writeSitemap(ctx: BuildContextMutable): Promise<void> {
  if (ctx.sitemapEntries.length === 0) return;

  try {
    // Build sitemap XML using the sitemap package utilities
    const sitemapModule = await import("sitemap");
    // Use the stream-based approach with streamToPromise
    const { SitemapStream, streamToPromise } = sitemapModule;
    const { Readable } = await import("node:stream");

    const stream = new SitemapStream({ hostname: ctx.config.baseUrl });
    const sitemapUrls = ctx.sitemapEntries.map((entry) => ({
      url: entry.url,
      lastmod: entry.lastModified,
      changefreq: entry.changeFrequency,
      priority: entry.priority,
    }));

    const readable = Readable.from(sitemapUrls).pipe(stream);
    const sitemapXml = (await streamToPromise(readable)).toString();

    const sitemapPath = join(ctx.outputDir, "sitemap.xml");
    writeFile(sitemapPath, sitemapXml);
  } catch {
    // Fallback: write minimal sitemap XML
    console.warn("[vetwo/docs] sitemap library unavailable, using fallback XML generator");
    const sitemapPath = join(ctx.outputDir, "sitemap.xml");
    const urlEntries = ctx.sitemapEntries
      .map(
        (e) =>
          `<url><loc>${escapeXml(e.url)}</loc><lastmod>${e.lastModified.toISOString()}</lastmod><changefreq>${e.changeFrequency}</changefreq><priority>${e.priority}</priority></url>`,
      )
      .join("\n");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>`;
    writeFile(sitemapPath, xml);
  }
}

/**
 * Writes a robots.txt file to the output directory.
 *
 * @param ctx - The mutable build context.
 *
 * @example
 * ```ts
 * writeRobotsTxt(ctx);
 * ```
 */
export function writeRobotsTxt(ctx: BuildContextMutable): void {
  if (!ctx.config.robots) return;

  const baseUrl = ctx.config.baseUrl.replace(/\/$/, "");
  const content = ["User-agent: *", "Allow: /", "", `Sitemap: ${baseUrl}/sitemap.xml`].join("\n");

  const robotsPath = join(ctx.outputDir, "robots.txt");
  writeFile(robotsPath, content);
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
