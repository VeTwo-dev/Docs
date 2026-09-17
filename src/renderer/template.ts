import type { DocPage } from "../types/public.js";
import type { BuildContextMutable } from "../types/internal.js";
import { escapeHtml } from "../utils/html.js";

/** A template that renders page data into an HTML string. */
export interface Template {
  readonly name: string;
  readonly render: (data: TemplateData) => string;
}

/** Data passed to a template for rendering a documentation page. */
export interface TemplateData {
  readonly page: DocPage;
  readonly config: BuildContextMutable["config"];
  readonly navItems: readonly { label: string; href: string }[];
  readonly sidebarGroups: readonly {
    title: string;
    items: readonly { label: string; href: string }[];
  }[];
}

/**
 * Creates the default HTML template for rendering documentation pages.
 *
 * @returns A Template instance with the name `"default"`.
 *
 * @example
 * ```ts
 * const tmpl = createDefaultTemplate();
 * const html = tmpl.render({ page, config, navItems, sidebarGroups });
 * ```
 */
export function createDefaultTemplate(): Template {
  return {
    name: "default",
    render: (data) =>
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(data.page.title)} - ${escapeHtml(data.config.title)}</title>
  <meta name="description" content="${escapeHtml(data.page.description)}">
</head>
<body>
  <header>
    <nav>
      <a href="${data.config.baseUrl}">${escapeHtml(data.config.title)}</a>
      ${data.navItems.map((item) => `<a href="${item.href}">${escapeHtml(item.label)}</a>`).join("\n      ")}
    </nav>
  </header>
  <aside>
    ${data.sidebarGroups
      .map(
        (group) =>
          `<section><h3>${escapeHtml(group.title)}</h3><ul>${group.items.map((item) => `<li><a href="${item.href}">${escapeHtml(item.label)}</a></li>`).join("")}</ul></section>`,
      )
      .join("\n    ")}
  </aside>
  <main>
    <article>${data.page.content}</article>
  </main>
</body>
</html>`,
  };
}
