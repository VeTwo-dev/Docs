/** Build the `static/README.md` placeholder. */
export function buildStaticReadme(): string {
  return [
    "# Static Output",
    "",
    "This directory contains **generated** static output (HTML, CSS, assets).",
    "It is produced by the documentation renderer and should not be edited by",
    "hand. `docs init` never cleans this directory and never overwrites files",
    "that already exist here.",
    "",
  ].join("\n");
}
