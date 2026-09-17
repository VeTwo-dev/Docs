import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "example-monorepo",
  description: "Documentation for the example-monorepo workspace",
  source: "./docs",
  output: "./docs-site",
  ignore: [
    "node_modules",
    "dist",
    "build",
    ".turbo",
    "coverage",
    ".docs-cache",
  ],
  sidebar: {
    auto: true,
    collapsed: false,
    groups: [
      {
        title: "Overview",
        items: ["index"],
      },
      {
        title: "Packages",
        items: ["packages/core", "packages/utils"],
      },
    ],
  },
  nav: {
    items: [
      { label: "Home", href: "/" },
      {
        label: "Packages",
        href: "/packages",
        items: [
          { label: "Core", href: "/packages/core" },
          { label: "Utils", href: "/packages/utils" },
        ],
      },
    ],
  },
});
