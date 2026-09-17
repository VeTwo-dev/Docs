import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "example-library",
  description: "Documentation for example-library",
  source: "./docs",
  output: "./docs-site",
  api: {
    enabled: true,
    source: "./src",
    include: ["index.ts"],
    exclude: ["**/*.test.*"],
    readme: true,
  },
  sidebar: {
    auto: true,
    collapsed: false,
  },
  nav: {
    items: [
      { label: "Home", href: "/" },
      { label: "Guides", href: "/guides/installation" },
      { label: "API", href: "/api" },
    ],
  },
});
