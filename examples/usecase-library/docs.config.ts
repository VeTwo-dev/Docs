import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "my-npm-package",
  description: "Library documentation for an npm package",
  source: "./docs",
  output: "./docs-site",
  api: {
    enabled: true,
    source: "./src",
    include: ["index.ts", "types.ts"],
    exclude: ["**/*.test.*"],
    readme: true,
  },
  search: {
    enabled: true,
    indexFields: ["title", "content"],
  },
  nav: {
    items: [
      { label: "Home", href: "/" },
      { label: "Getting Started", href: "/getting-started" },
      { label: "API", href: "/api" },
      { label: "GitHub", href: "https://github.com/example/my-package" },
    ],
  },
  sidebar: {
    auto: true,
    groups: [
      { title: "Getting Started", items: ["index", "getting-started", "installation"] },
      { title: "Guides", items: ["guides/configuration", "guides/advanced"] },
      { title: "API Reference", items: ["api"] },
    ],
  },
});
