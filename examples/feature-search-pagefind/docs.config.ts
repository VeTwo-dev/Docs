import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "Pagefind Search",
  description: "Pagefind-based static search",
  source: "./docs",
  output: "./docs-site",
  search: {
    enabled: true,
    engine: "pagefind",
    indexFields: ["title", "content"],
    maxResults: 15,
  },
});
