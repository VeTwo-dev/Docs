import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "MDX Interactive",
  description: "MDX interactive components",
  source: "./docs",
  output: "./docs-site",
  markdown: {
    mdx: true,
  },
});
