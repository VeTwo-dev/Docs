import { defineDocs } from "@vetwo/docs";
import { analyticsPlugin } from "./plugins/analytics.js";

export default defineDocs({
  title: "Advanced Plugins",
  description: "Custom plugin with all lifecycle hooks",
  source: "./docs",
  output: "./docs-site",
  plugins: [analyticsPlugin({ trackingId: "UA-XXXXX" })],
});
