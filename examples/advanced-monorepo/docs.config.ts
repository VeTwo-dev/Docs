import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "Monorepo Docs",
  description: "Monorepo workspace documentation",
  source: "./docs",
  output: "./docs-site",
  monorepo: {
    root: "../..",
  },
  sidebar: {
    auto: true,
    groups: [
      { title: "Overview", items: ["index"] },
      { title: "Packages", items: ["packages/core", "packages/utils"] },
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
