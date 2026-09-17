/** Shared description mapper for npm/package scripts. */
export function describeScript(name: string): string {
  const descriptions: Record<string, string> = {
    dev: "Start development server",
    build: "Build for production",
    test: "Run tests",
    lint: "Lint source code",
    format: "Format code",
    start: "Start the application",
    preview: "Preview production build",
    clean: "Clean build artifacts",
    typecheck: "Run TypeScript type checking",
    prepublishOnly: "Prepare for publishing",
    postinstall: "Post-install hooks",
  };
  if (descriptions[name]) return descriptions[name];
  if (name.startsWith("test:")) return `Run ${name.slice(5)} tests`;
  if (name.startsWith("build:")) return `Build ${name.slice(6)}`;
  if (name.startsWith("lint:")) return `Lint ${name.slice(5)}`;
  return `Run ${name}`;
}
