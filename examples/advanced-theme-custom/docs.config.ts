import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "Custom Theme",
  description: "Custom theme configuration with colors and fonts",
  source: "./docs",
  output: "./docs-site",
  theme: {
    name: "custom-brand",
    colors: {
      primary: "#6366f1",
      secondary: "#8b5cf6",
      background: "#ffffff",
      surface: "#f8fafc",
      text: "#1e293b",
      muted: "#64748b",
      accent: "#06b6d4",
    },
    fonts: {
      heading: "'Inter', sans-serif",
      body: "'Inter', sans-serif",
      code: "'JetBrains Mono', monospace",
    },
    logo: "./assets/logo.svg",
    favicon: "./assets/favicon.ico",
  },
});
