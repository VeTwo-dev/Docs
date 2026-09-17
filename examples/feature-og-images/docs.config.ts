import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "OG Images",
  description: "Open Graph image generation",
  source: "./docs",
  output: "./docs-site",
  baseUrl: "https://example.com",
  og: true,
  seo: {
    title: "OG Image Example",
    description: "Auto-generated Open Graph images for social sharing",
    image: "/og-default.png",
    twitter: "@example",
  },
});
