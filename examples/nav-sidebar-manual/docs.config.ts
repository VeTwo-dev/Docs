import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "Manual Sidebar",
  description: "Manually configured sidebar groups",
  source: "./docs",
  output: "./docs-site",
  sidebar: {
    auto: false,
    groups: [
      {
        title: "Getting Started",
        items: ["index", "installation"],
      },
      {
        title: "Core Concepts",
        items: ["routing", "middleware"],
      },
      {
        title: "Advanced",
        items: ["plugins", "deployment"],
      },
    ],
  },
});
