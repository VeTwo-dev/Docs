import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "Search - MiniSearch",
  description: "Full-text search with minisearch",
  source: "./docs",
  output: "./docs-site",
  search: {
    enabled: true,
    engine: "minisearch",
    indexFields: ["title", "content", "category"],
    maxResults: 20,
  },
});
