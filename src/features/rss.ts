import type { RssEntry } from "../types/public.js";
import type { BuildContextMutable } from "../types/internal.js";
import { writeFile } from "../filesystem/index.js";
import { join } from "node:path";

/**
 * Generates RSS feed entries from the pages in the build context.
 *
 * @param ctx - The mutable build context containing pages.
 *
 * @example
 * ```ts
 * generateRssFeed(ctx);
 * ```
 */
export function generateRssFeed(ctx: BuildContextMutable): void {
  if (!ctx.config.rss) return;

  const baseUrl = ctx.config.baseUrl.replace(/\/+$/, "");
  const entries: RssEntry[] = ctx.pages.map((page) => ({
    title: page.title,
    link: `${baseUrl}${page.slug}`,
    description: page.description,
    pubDate: page.lastModified,
    guid: `${baseUrl}${page.slug}`,
  }));

  (ctx as { rssEntries: RssEntry[] }).rssEntries = entries;
}

/**
 * Writes the generated RSS feed to the output directory as an XML file
 * using the `feed` library for proper RSS 2.0 / Atom generation.
 *
 * @param ctx - The mutable build context containing RSS entries.
 *
 * @example
 * ```ts
 * writeRssFeed(ctx);
 * ```
 */
export async function writeRssFeed(ctx: BuildContextMutable): Promise<void> {
  if (ctx.rssEntries.length === 0) return;

  try {
    const { Feed } = await import("feed");

    const baseUrl = ctx.config.baseUrl.replace(/\/+$/, "");
    const rssOpts = ctx.config.rssOptions;
    const feed = new Feed({
      title: rssOpts.title ?? ctx.config.title,
      description: rssOpts.description ?? ctx.config.description,
      id: baseUrl,
      link: rssOpts.link ?? baseUrl,
      language: rssOpts.language ?? "en",
      copyright: `All rights reserved ${new Date().getFullYear()}`,
      generator: "@vetwo/docs",
    });

    for (const entry of ctx.rssEntries) {
      feed.addItem({
        title: entry.title,
        id: entry.guid,
        link: entry.link,
        description: entry.description,
        date: entry.pubDate,
      });
    }

    const rssPath = join(ctx.outputDir, "feed.xml");
    writeFile(rssPath, feed.rss2());

    const atomPath = join(ctx.outputDir, "atom.xml");
    writeFile(atomPath, feed.atom1());
  } catch {
    // Fallback: write minimal RSS XML if feed library fails
    console.warn("[vetwo/docs] feed library unavailable, using fallback RSS generator");
    const rssPath = join(ctx.outputDir, "feed.xml");
    const items = ctx.rssEntries
      .map(
        (e) =>
          `<item><title>${escapeXml(e.title)}</title><link>${escapeXml(e.link)}</link><description>${escapeXml(e.description)}</description><pubDate>${e.pubDate.toISOString()}</pubDate><guid>${escapeXml(e.guid)}</guid></item>`,
      )
      .join("\n");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${escapeXml(ctx.config.title)}</title><link>${escapeXml(ctx.config.baseUrl)}</link><description>${escapeXml(ctx.config.description)}</description>${items}</channel></rss>`;
    writeFile(rssPath, xml);
  }
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
