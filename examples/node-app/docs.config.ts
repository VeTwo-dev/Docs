import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "example-node-app",
  description: "Documentation for a Node.js application built with @vetwo/docs",
  source: "./docs",
  output: "./docs-site",
  baseUrl: "/docs",
  seo: {
    title: "example-node-app",
    description: "API documentation for the example Node.js application",
    image: "/og.png",
    twitter: "@vetwo",
  },
  sidebar: {
    auto: true,
    collapsed: false,
    groups: [
      {
        title: "Getting Started",
        items: ["index"],
      },
      {
        title: "API Reference",
        items: ["api/server"],
      },
    ],
  },
  nav: {
    items: [
      { label: "Home", href: "/" },
      { label: "API", href: "/api/server" },
    ],
  },
});
