import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "GFM Example",
  description: "GitHub Flavored Markdown features",
  source: "./docs",
  output: "./docs-site",
  markdown: {
    gfm: true,
  },
});
