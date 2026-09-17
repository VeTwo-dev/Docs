import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "Custom Navigation",
  description: "Custom top navigation bar example",
  source: "./docs",
  output: "./docs-site",
  nav: {
    items: [
      { label: "Home", href: "/" },
      { label: "Guide", href: "/guide" },
      {
        label: "Resources",
        href: "/resources",
        items: [
          { label: "Blog", href: "/resources/blog" },
          { label: "Changelog", href: "/resources/changelog" },
        ],
      },
      { label: "GitHub", href: "https://github.com/example/repo" },
    ],
  },
});
