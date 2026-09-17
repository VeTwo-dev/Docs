import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "Getting Started",
  description: "Quick start guide for @vetwo/docs",
  source: "./docs",
  output: "./docs-site",
  sidebar: {
    auto: true,
    collapsed: false,
  },
});
