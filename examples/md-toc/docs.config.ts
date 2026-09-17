import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "Table of Contents",
  description: "Table of contents configuration",
  source: "./docs",
  output: "./docs-site",
  markdown: {
    toc: true,
    tocDepth: 4,
  },
});
