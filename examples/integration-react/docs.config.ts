import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "React Renderer",
  description: "React renderer components usage",
  source: "./docs",
  output: "./docs-site",
  markdown: {
    mdx: true,
  },
  nav: {
    items: [
      { label: "Home", href: "/" },
      { label: "Components", href: "/components" },
    ],
  },
});
