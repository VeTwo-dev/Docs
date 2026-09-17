import { defineDocs } from "@vetwo/docs";

export default defineDocs({
  title: "CI/CD Example",
  description: "GitHub Actions workflow for docs deployment",
  source: "./docs",
  output: "./docs-site",
  baseUrl: "https://myorg.github.io/my-repo",
  sitemap: true,
  robots: true,
  seo: {
    title: "CI/CD Docs",
    description: "Documentation deployed with GitHub Actions",
  },
});
