import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "example-bun",
  description: "Documentation for a Bun project using @vetwo/docs",
  source: "./docs",
  output: "./docs-site",
  cache: true,
  search: {
    enabled: true,
    maxResults: 10,
  },
});
