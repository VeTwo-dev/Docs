import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "Frontmatter Demo",
  description: "Demonstrates frontmatter usage across pages",
  source: "./docs",
  output: "./docs-site",
  seo: {
    title: "Frontmatter Demo",
    description: "A demo of frontmatter in @vetwo/docs",
  },
});
