import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "REST API Reference",
  description: "REST API reference documentation",
  source: "./docs",
  output: "./docs-site",
  baseUrl: "https://api.example.com",
  sitemap: true,
  search: {
    enabled: true,
    indexFields: ["title", "content"],
  },
  nav: {
    items: [
      { label: "Overview", href: "/" },
      { label: "Authentication", href: "/authentication" },
      { label: "Users", href: "/endpoints/users" },
      { label: "Posts", href: "/endpoints/posts" },
    ],
  },
  sidebar: {
    auto: true,
    groups: [
      { title: "Overview", items: ["index", "authentication"] },
      { title: "Endpoints", items: ["endpoints/users", "endpoints/posts"] },
    ],
  },
});
