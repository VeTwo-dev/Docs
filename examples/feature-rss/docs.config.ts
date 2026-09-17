import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "RSS Feed",
  description: "RSS feed generation",
  source: "./docs",
  output: "./docs-site",
  rss: true,
  rssOptions: {
    title: "My Documentation Blog",
    description: "Latest documentation updates",
    link: "https://example.com",
    language: "en",
  },
});
