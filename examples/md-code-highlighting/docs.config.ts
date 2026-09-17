import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "Code Highlighting",
  description: "Shiki syntax highlighting with line numbers and highlights",
  source: "./docs",
  output: "./docs-site",
  markdown: {
    syntaxHighlighting: true,
    lineHighlighting: true,
    diffHighlighting: true,
    focusRegions: true,
  },
});
