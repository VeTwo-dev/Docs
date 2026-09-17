import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "Auto Sidebar",
  description: "Sidebar auto-generated from directory structure",
  source: "./docs",
  output: "./docs-site",
  sidebar: {
    auto: true,
    collapsed: false,
  },
});
