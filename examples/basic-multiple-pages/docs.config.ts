import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "Multiple Pages",
  description: "Five pages with different categories",
  source: "./docs",
  output: "./docs-site",
  sidebar: {
    auto: true,
    groups: [
      { title: "Getting Started", items: ["index", "installation", "quick-start"] },
      { title: "Guides", items: ["guides/configuration", "guides/deployment"] },
    ],
  },
});
