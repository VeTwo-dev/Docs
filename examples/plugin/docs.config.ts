import { defineDocs } from "@vetwo/docs";
import { myPlugin } from "./plugins/my-plugin.js";

export default defineDocs({
  title: "example-plugin",
  description: "Documentation demonstrating a custom @vetwo/docs plugin",
  source: "./docs",
  output: "./docs-site",
  plugins: [
    myPlugin(),
  ],
});
