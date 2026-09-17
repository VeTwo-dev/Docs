import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "Smartypants",
  description: "Smart quotes and typography",
  source: "./docs",
  output: "./docs-site",
  markdown: {
    smartypants: true,
  },
});
