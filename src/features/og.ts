import type { DocPage } from "../types/public.js";
import type { BuildContextMutable } from "../types/internal.js";
import { writeFile, ensureDir } from "../filesystem/index.js";
import { join } from "node:path";

/**
 * Generates OpenGraph images for each page using satori and resvg.
 * Outputs PNG files to the `og/` subdirectory of the output folder.
 *
 * @param ctx - The mutable build context containing pages and config.
 *
 * @example
 * ```ts
 * await generateOgImages(ctx);
 * ```
 */
export async function generateOgImages(ctx: BuildContextMutable): Promise<void> {
  const ogDir = join(ctx.outputDir, "og");
  ensureDir(ogDir);

  try {
    const satoriModule = await import("satori");
    const satoriFn = satoriModule.default;
    const { Resvg } = await import("@resvg/resvg-js");

    for (const page of ctx.pages) {
      try {
        const svg = await satoriFn(createOgSvg(page, ctx.config.title), {
          width: 1200,
          height: 630,
          fonts: [
            {
              name: "Inter",
              data: getInterFontData(),
              style: "normal",
            },
          ],
        });

        const resvg = new Resvg(svg, {
          fitTo: { mode: "width", value: 1200 },
        });
        const pngData = resvg.render();
        const pngBuffer = pngData.asPng();

        const slug = page.slug.replace(/^\//, "").replace(/\/$/, "") || "index";
        const outputPath = join(ogDir, `${slug}.png`);
        ensureDir(join(ogDir, slug.split("/").slice(0, -1).join("/") || "."));
        writeFile(outputPath, Buffer.from(pngBuffer).toString("binary"));
      } catch {
        // Skip individual page failures silently
        console.warn(`[vetwo/docs] failed to generate OG image for page`);
      }
    }
  } catch {
    // satori or resvg not available, skip OG generation
    console.warn("[vetwo/docs] satori or resvg not available, skipping OG image generation");
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createOgSvg(page: DocPage, siteTitle: string): any {
  return {
    type: "div",
    props: {
      children: [
        {
          type: "div",
          props: {
            children: siteTitle,
            style: {
              fontSize: 24,
              color: "#6b7280",
              marginBottom: 16,
            },
          },
        },
        {
          type: "div",
          props: {
            children: page.title,
            style: {
              fontSize: 48,
              fontWeight: 700,
              color: "#1a1a1a",
              lineHeight: 1.2,
              marginBottom: 24,
            },
          },
        },
        {
          type: "div",
          props: {
            children: page.description.slice(0, 120),
            style: {
              fontSize: 24,
              color: "#4b5563",
              lineHeight: 1.4,
            },
          },
        },
      ],
      style: {
        width: 1200,
        height: 630,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 60,
        background: "#ffffff",
      },
    },
  };
}

function getInterFontData(): ArrayBuffer {
  // In production, load the actual Inter font file.
  // For now return an empty buffer - satori will fall back to system fonts.
  return new ArrayBuffer(0);
}
