import { defineDocs, mermaid } from "@vetwo/docs";

export default defineDocs({
  title: "Mermaid Diagrams",
  description: "Mermaid diagram integration",
  source: "./docs",
  output: "./docs-site",
  plugins: [mermaid()],
});
