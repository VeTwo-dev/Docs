import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "Versioned Docs",
  description: "Multi-version documentation",
  source: "./docs",
  output: "./docs-site",
  versioning: {
    enabled: true,
    current: "v2.0",
    versions: ["v1.0", "v1.1", "v2.0"],
  },
});
