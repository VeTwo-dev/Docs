import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "Collapsed Sidebar",
  description: "Collapsible sidebar sections",
  source: "./docs",
  output: "./docs-site",
  sidebar: {
    auto: true,
    collapsed: true,
  },
});
