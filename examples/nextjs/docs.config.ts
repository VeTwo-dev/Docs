import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "example-nextjs",
  description: "Documentation for the example Next.js project",
  source: "./docs",
  output: "./docs-site",
  baseUrl: "/docs",
  clean: true,
  cache: true,
  search: {
    enabled: true,
    maxResults: 20,
  },
  seo: {
    title: "example-nextjs",
    description: "Documentation for a Next.js project powered by @vetwo/docs",
  },
  sidebar: {
    auto: true,
    collapsed: false,
  },
  nav: {
    items: [
      { label: "Home", href: "/" },
      { label: "GitHub", href: "https://github.com/example/nextjs", external: true },
    ],
  },
});
