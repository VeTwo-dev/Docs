import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "Documentation Blog",
  description: "Documentation-as-blog with RSS",
  source: "./docs",
  output: "./docs-site",
  baseUrl: "https://blog.example.com",
  rss: true,
  rssOptions: {
    title: "My Documentation Blog",
    description: "Technical articles and tutorials",
    link: "https://blog.example.com",
    language: "en",
  },
  sitemap: true,
  search: {
    enabled: true,
    indexFields: ["title", "content", "category"],
  },
  nav: {
    items: [
      { label: "Home", href: "/" },
      { label: "Articles", href: "/articles" },
      { label: "Tutorials", href: "/tutorials" },
      { label: "RSS", href: "/feed.xml" },
    ],
  },
  sidebar: {
    auto: true,
    groups: [
      {
        title: "Articles",
        items: ["index", "articles/typescript-tips", "articles/node-performance"],
      },
      { title: "Tutorials", items: ["tutorials/getting-started", "tutorials/advanced-patterns"] },
    ],
  },
});
