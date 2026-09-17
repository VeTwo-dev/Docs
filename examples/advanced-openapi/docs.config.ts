import { defineDocs, openApi } from "@vetwo/docs";

export default defineDocs({
  title: "OpenAPI Docs",
  description: "OpenAPI specification documentation",
  source: "./docs",
  output: "./docs-site",
  plugins: [openApi({ spec: "./openapi.yaml" })],
  sidebar: {
    auto: true,
    groups: [
      { title: "Overview", items: ["index"] },
      { title: "API", items: ["api-reference"] },
    ],
  },
  nav: {
    items: [
      { label: "Home", href: "/" },
      { label: "API Reference", href: "/api-reference" },
    ],
  },
});
