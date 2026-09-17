import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "Changelog",
  description: "Changelog-style documentation with RSS",
  source: "./docs",
  output: "./docs-site",
  baseUrl: "https://example.com",
  rss: true,
  rssOptions: {
    title: "Project Changelog",
    description: "Latest releases and updates",
    link: "https://example.com/changelog",
  },
  sitemap: true,
  search: {
    enabled: true,
    indexFields: ["title", "content"],
  },
  nav: {
    items: [
      { label: "Home", href: "/" },
      { label: "Changelog", href: "/changelog" },
      { label: "Releases", href: "/releases" },
    ],
  },
  sidebar: {
    auto: true,
    collapsed: true,
    groups: [
      { title: "Overview", items: ["index"] },
      { title: "Releases", items: ["changelog/v2.0.0", "changelog/v1.1.0", "changelog/v1.0.0"] },
    ],
  },
});
