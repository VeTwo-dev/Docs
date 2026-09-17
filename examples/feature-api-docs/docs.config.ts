import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "API Docs",
  description: "TypeDoc API documentation generation",
  source: "./docs",
  output: "./docs-site",
  api: {
    enabled: true,
    source: "./src",
    include: ["index.ts", "types.ts"],
    exclude: ["**/*.test.*", "**/*.spec.*"],
    readme: true,
  },
});
