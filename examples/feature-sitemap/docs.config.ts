import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "Sitemap",
  description: "Sitemap.xml generation with baseUrl",
  source: "./docs",
  output: "./docs-site",
  baseUrl: "https://example.com",
  sitemap: true,
});
