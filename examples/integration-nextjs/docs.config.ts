import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "Next.js Integration",
  description: "Integration with Next.js React components",
  source: "./docs",
  output: "./docs-site",
  baseUrl: "/docs",
  markdown: {
    mdx: true,
  },
  search: {
    enabled: true,
    maxResults: 20,
  },
  seo: {
    title: "Next.js Docs",
    description: "Documentation integrated with a Next.js application",
  },
  nav: {
    items: [
      { label: "Home", href: "/" },
      { label: "Guide", href: "/guide" },
      { label: "Components", href: "/components" },
    ],
  },
});
