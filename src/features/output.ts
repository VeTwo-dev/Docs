import type { BuildContextMutable } from "../types/internal.js";
import type { Theme } from "../themes/types.js";
import type { ApiDocEntry } from "../types/public.js";
import { writeFile } from "../filesystem/index.js";
import { resolveTheme, generateStylesheet } from "../themes/index.js";
import { generateComponentCSS } from "../components/index.js";
import { join } from "node:path";
import { escapeHtml, escapeUrlAttr } from "../utils/html.js";

/**
 * Renders each page as HTML and writes it to the output directory.
 * Also writes the theme stylesheet, component CSS, and search UI script.
 *
 * @param ctx - The mutable build context containing pages and config.
 */
export function writePages(ctx: BuildContextMutable): void {
  const theme = resolveThemeFromConfig(ctx.config.theme);
  const themeCSS = generateStylesheet(theme);
  const componentCSS = generateComponentCSS();
  const stylesheet = themeCSS + "\n" + componentCSS;

  for (let i = 0; i < ctx.pages.length; i++) {
    const page = ctx.pages[i]!;
    const prev = i > 0 ? ctx.pages[i - 1] : undefined;
    const next = i < ctx.pages.length - 1 ? ctx.pages[i + 1] : undefined;
    const outputPath = join(ctx.outputDir, `${page.slug}.html`);
    const html = renderPage(ctx, page, prev, next);
    writeFile(outputPath, html);
  }

  // Write API doc pages
  for (const apiEntry of ctx.apiDocs) {
    const outputPath = join(
      ctx.outputDir,
      `api/${apiEntry.name.toLowerCase().replace(/\s+/g, "-")}.html`,
    );
    const html = renderApiPage(ctx, apiEntry);
    writeFile(outputPath, html);
  }

  const cssPath = join(ctx.outputDir, "styles.css");
  writeFile(cssPath, stylesheet);

  // Write search UI script
  const searchScript = generateSearchScript(ctx.config.baseUrl);
  writeFile(join(ctx.outputDir, "search.js"), searchScript);

  // Write search page
  const searchPage = generateSearchPage(ctx.config.title, ctx.config.baseUrl);
  writeFile(join(ctx.outputDir, "search.html"), searchPage);
}

function resolveThemeFromConfig(
  theme:
    | string
    | {
        readonly name?: string;
        readonly logo?: string;
        readonly favicon?: string;
        readonly cssOverrides?: string;
      },
): Theme {
  if (typeof theme === "string") {
    return resolveTheme(theme);
  }
  if (theme.name) {
    return resolveTheme(theme.name);
  }
  return resolveTheme("default");
}

function renderPage(
  ctx: BuildContextMutable,
  page: {
    title: string;
    description: string;
    content: string;
    slug: string;
    headings?: readonly { level: number; id: string; text: string }[];
  },
  prev?: { title: string; slug: string },
  next?: { title: string; slug: string },
): string {
  const baseUrl = ctx.config.baseUrl.replace(/\/$/, "");
  const title = `${page.title} - ${ctx.config.title}`;
  const sidebar = renderSidebar(ctx.sidebarGroups);
  const header = renderHeader(ctx.navItems);
  const logo =
    typeof ctx.config.theme === "object" && ctx.config.theme.logo
      ? `<img src="${escapeUrlAttr(ctx.config.theme.logo)}" alt="${escapeHtml(ctx.config.title)}" class="header-logo">`
      : "";
  const favicon =
    typeof ctx.config.theme === "object" && ctx.config.theme.favicon
      ? `<link rel="icon" href="${escapeUrlAttr(ctx.config.theme.favicon)}">`
      : "";
  const rssLink = ctx.config.rss
    ? `<link rel="alternate" type="application/rss+xml" title="${escapeHtml(ctx.config.title)} RSS" href="${baseUrl}/feed.xml">`
    : "";
  const ogImage =
    ctx.config.og !== false ? `${baseUrl}/og/${page.slug.replace(/^\//, "")}.png` : "";
  const searchEnabled = ctx.config.search.enabled;
  const seo = ctx.config.seo;
  const twitterHandle = seo.twitter ?? "";

  const prevNextNav = renderPrevNext(prev, next);

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(page.description)}">
  <meta property="og:title" content="${escapeHtml(page.title)}">
  <meta property="og:description" content="${escapeHtml(page.description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${baseUrl}${page.slug}">
  ${ogImage ? `<meta property="og:image" content="${ogImage}">` : ""}
  ${twitterHandle ? `<meta name="twitter:card" content="summary_large_image">` : `<meta name="twitter:card" content="summary">`}
  ${twitterHandle ? `<meta name="twitter:site" content="${escapeHtml(twitterHandle)}">` : ""}
  <meta name="twitter:title" content="${escapeHtml(page.title)}">
  <meta name="twitter:description" content="${escapeHtml(page.description)}">
  ${ogImage ? `<meta name="twitter:image" content="${ogImage}">` : ""}
  <link rel="canonical" href="${baseUrl}${page.slug}">
  ${favicon}
  ${rssLink}
  <link rel="stylesheet" href="${baseUrl}/styles.css">
</head>
<body>
  <header class="site-header">
    <div class="header-inner">
      <div class="header-left">
        <a href="${baseUrl}/" class="header-brand">
          ${logo}
          ${escapeHtml(ctx.config.title)}
        </a>
        ${header}
      </div>
      <div class="header-right">
        ${
          searchEnabled
            ? `<div class="search-wrapper">
          <a href="${baseUrl}/search.html" class="search-link" aria-label="Search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </a>
        </div>`
            : ""
        }
        <button class="theme-toggle" id="theme-toggle" type="button" aria-label="Toggle dark mode">
          <svg class="icon-sun" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          <svg class="icon-moon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>
      </div>
    </div>
  </header>
  <div class="layout">
    ${sidebar ? `<aside class="sidebar">${sidebar}</aside>` : ""}
    <main class="content">
      <article>
        <h1>${escapeHtml(page.title)}</h1>
        ${page.content}
      </article>
      ${prevNextNav}
    </main>
  </div>
  <footer class="site-footer">
    <p>Generated by <a href="https://github.com/vetwo/docs">@vetwo/docs</a></p>
  </footer>
  <script>
    (function() {
      var toggle = document.getElementById('theme-toggle');
      var stored = localStorage.getItem('theme');
      if (stored) {
        document.documentElement.setAttribute('data-theme', stored);
      } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
      toggle.addEventListener('click', function() {
        var current = document.documentElement.getAttribute('data-theme');
        var next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
      });
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', function(e) {
        if (!localStorage.getItem('theme')) {
          document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        }
      });
    })();
  </script>
</body>
</html>`;
}

function renderApiPage(ctx: BuildContextMutable, entry: ApiDocEntry): string {
  const baseUrl = ctx.config.baseUrl.replace(/\/$/, "");
  const title = `${entry.name} - ${ctx.config.title} API`;
  const sidebar = renderSidebar(ctx.sidebarGroups);
  const header = renderHeader(ctx.navItems);

  const paramsHtml =
    entry.parameters.length > 0
      ? `<h3>Parameters</h3>\n<table>\n<thead><tr><th>Name</th><th>Type</th><th>Description</th></tr></thead>\n<tbody>\n${entry.parameters.map((p) => `<tr><td><code>${escapeHtml(p.name)}</code>${p.required ? "" : "?"}</td><td><code>${escapeHtml(p.type)}</code></td><td>${escapeHtml(p.description)}</td></tr>`).join("\n")}\n</tbody>\n</table>`
      : "";

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(entry.description)}">
  <link rel="stylesheet" href="${baseUrl}/styles.css">
</head>
<body>
  <header class="site-header">
    <div class="header-inner">
      <div class="header-left">
        <a href="${baseUrl}/" class="header-brand">${escapeHtml(ctx.config.title)}</a>
        ${header}
      </div>
      <div class="header-right">
        <button class="theme-toggle" id="theme-toggle" type="button" aria-label="Toggle dark mode">
          <svg class="icon-sun" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          <svg class="icon-moon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>
      </div>
    </div>
  </header>
  <div class="layout">
    ${sidebar ? `<aside class="sidebar">${sidebar}</aside>` : ""}
    <main class="content">
      <article>
        <div class="api-badge">${escapeHtml(entry.kind)}</div>
        <h1>${escapeHtml(entry.name)}</h1>
        ${entry.description ? `<p class="api-description">${escapeHtml(entry.description)}</p>` : ""}
        ${entry.signature ? `<pre><code>${escapeHtml(entry.signature)}</code></pre>` : ""}
        ${paramsHtml}
        ${entry.returnType ? `<h3>Returns</h3><p><code>${escapeHtml(entry.returnType)}</code></p>` : ""}
        ${entry.tags.length > 0 ? `<div class="api-tags">${entry.tags.map((t) => `<span class="api-tag">${escapeHtml(t)}</span>`).join(" ")}</div>` : ""}
      </article>
    </main>
  </div>
  <footer class="site-footer">
    <p>Generated by <a href="https://github.com/vetwo/docs">@vetwo/docs</a></p>
  </footer>
  <script>
    (function() {
      var toggle = document.getElementById('theme-toggle');
      var stored = localStorage.getItem('theme');
      if (stored) {
        document.documentElement.setAttribute('data-theme', stored);
      } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
      toggle.addEventListener('click', function() {
        var current = document.documentElement.getAttribute('data-theme');
        var next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
      });
    })();
  </script>
</body>
</html>`;
}

function renderPrevNext(
  prev?: { title: string; slug: string },
  next?: { title: string; slug: string },
): string {
  if (!prev && !next) return "";
  return `<nav class="prev-next-nav">
    ${prev ? `<a href="${prev.slug}" class="prev-link">&larr; ${escapeHtml(prev.title)}</a>` : "<span></span>"}
    ${next ? `<a href="${next.slug}" class="next-link">${escapeHtml(next.title)} &rarr;</a>` : "<span></span>"}
  </nav>`;
}

function renderHeader(navItems: readonly { label: string; href: string }[]): string {
  if (navItems.length === 0) return "";
  return `<nav class="header-nav">
    ${navItems.map((item) => `<a href="${item.href}">${escapeHtml(item.label)}</a>`).join("\n    ")}
  </nav>`;
}

function renderSidebar(
  sidebarGroups: readonly { title: string; items: readonly { label: string; href?: string }[] }[],
): string {
  if (sidebarGroups.length === 0) return "";
  return sidebarGroups
    .map(
      (group) =>
        `<div class="sidebar-group">
        <h3 class="sidebar-title">${escapeHtml(group.title)}</h3>
        <ul class="sidebar-list">
          ${group.items.map((item) => `<li><a href="${item.href ?? "#"}">${escapeHtml(item.label)}</a></li>`).join("\n          ")}
        </ul>
      </div>`,
    )
    .join("\n    ");
}

function generateSearchScript(baseUrl: string): string {
  return `
(function() {
  var searchIndex = null;
  var searchInput = null;
  var resultsContainer = null;

  function escHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escAttr(s) {
    return String(s || '#')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  async function loadSearchIndex() {
    if (searchIndex) return searchIndex;
    try {
      var response = await fetch('${baseUrl}/search-index.json');
      searchIndex = await response.json();
      return searchIndex;
    } catch(e) {
      return { entries: [] };
    }
  }

  function performSearch(query, index) {
    if (!query || !index || !index.entries) return [];
    var lower = query.toLowerCase();
    return index.entries.filter(function(entry) {
      return (entry.title && entry.title.toLowerCase().includes(lower)) ||
             (entry.content && entry.content.toLowerCase().includes(lower)) ||
             (entry.category && entry.category.toLowerCase().includes(lower));
    }).slice(0, 20);
  }

  window.initSearch = function(inputId, resultsId) {
    searchInput = document.getElementById(inputId);
    resultsContainer = document.getElementById(resultsId);
    if (!searchInput || !resultsContainer) return;

    searchInput.addEventListener('input', async function() {
      var query = searchInput.value.trim();
      if (query.length < 2) {
        resultsContainer.innerHTML = '';
        resultsContainer.style.display = 'none';
        return;
      }
      var index = await loadSearchIndex();
      var results = performSearch(query, index);
      if (results.length === 0) {
        resultsContainer.innerHTML = '<div class="search-no-results">No results found</div>';
      } else {
        resultsContainer.innerHTML = results.map(function(r) {
          return '<a href="' + escAttr(r.url) + '" class="search-result">' +
            '<div class="search-result-title">' + escHtml(r.title || 'Untitled') + '</div>' +
            '<div class="search-result-content">' + escHtml((r.content || '').substring(0, 120)) + '...</div>' +
          '</a>';
        }).join('');
      }
      resultsContainer.style.display = 'block';
    });
  };
})();`;
}

function generateSearchPage(title: string, baseUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Search - ${escapeHtml(title)}</title>
  <link rel="stylesheet" href="${baseUrl}/styles.css">
  <style>
    .search-page { max-width: 640px; margin: 0 auto; padding: 2rem; }
    .search-page input { width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--light-border); border-radius: var(--border-radius); font-size: 1rem; background: var(--light-background); color: var(--light-text); }
    .search-results { margin-top: 1.5rem; }
    .search-result { display: block; padding: 1rem; border: 1px solid var(--light-border); border-radius: var(--border-radius); margin-bottom: 0.75rem; text-decoration: none; color: var(--light-text); }
    .search-result:hover { border-color: var(--light-primary); background: var(--light-surface); text-decoration: none; }
    .search-result-title { font-weight: 600; margin-bottom: 0.25rem; }
    .search-result-content { font-size: 0.875rem; color: var(--light-text-muted); }
    .search-no-results { color: var(--light-text-muted); padding: 1rem; text-align: center; }
  </style>
</head>
<body>
  <header class="site-header">
    <div class="header-inner">
      <div class="header-left">
        <a href="${baseUrl}/" class="header-brand">${escapeHtml(title)}</a>
      </div>
      <div class="header-right">
        <button class="theme-toggle" id="theme-toggle" type="button" aria-label="Toggle dark mode">
          <svg class="icon-sun" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          <svg class="icon-moon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>
      </div>
    </div>
  </header>
  <main class="search-page">
    <h1>Search</h1>
    <input type="text" id="search-input" placeholder="Search documentation..." autofocus>
    <div class="search-results" id="search-results"></div>
  </main>
  <script src="${baseUrl}/search.js"></script>
  <script>
    initSearch('search-input', 'search-results');
    var toggle = document.getElementById('theme-toggle');
    var stored = localStorage.getItem('theme');
    if (stored) document.documentElement.setAttribute('data-theme', stored);
    else if (window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.setAttribute('data-theme', 'dark');
    toggle.addEventListener('click', function() {
      var current = document.documentElement.getAttribute('data-theme');
      var next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
    });
  </script>
</body>
</html>`;
}
