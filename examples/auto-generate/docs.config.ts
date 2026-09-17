import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  generator: {
    enabled: true,
    output: "./generated-docs",
    overwrite: false,
    api: true,
    architecture: true,
    guides: true,
    configuration: true,
    cli: true,
    faq: true,
    troubleshooting: true,
    examples: true,
  },
  site: {
    title: "My Library",
    description: "A sample library with auto-generated docs",
  },
});
