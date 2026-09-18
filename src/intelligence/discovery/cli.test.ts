import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { discoverCliCommands } from "./cli.js";

const FIXTURE = join(tmpdir(), "vetwo-cli-discovery");

describe("discoverCliCommands", () => {
  beforeAll(() => {
    rmSync(FIXTURE, { recursive: true, force: true });
    mkdirSync(join(FIXTURE, "src"), { recursive: true });
    writeFileSync(
      join(FIXTURE, "package.json"),
      JSON.stringify({ name: "my-cli", version: "1.0.0", bin: { mycli: "./src/cli.js" } }),
    );
    writeFileSync(
      join(FIXTURE, "src/cli.js"),
      [
        `program.command("serve").description("Serve the site").action(() => {});`,
        `program.command("build").description("Build the site").action(() => {});`,
        `// program.command("imaginary") is commented out, not a command.`,
      ].join("\n"),
    );
  });

  afterAll(() => {
    rmSync(FIXTURE, { recursive: true, force: true });
  });

  it("discovers bin entries and commander definitions with descriptions", () => {
    const commands = discoverCliCommands(FIXTURE);
    const names = commands.map((c) => c.name);
    expect(names).toContain("mycli");
    expect(names).toContain("serve");
    expect(names).toContain("build");
    expect(commands.find((c) => c.name === "serve")?.description).toBe("Serve the site");
    expect(names).not.toContain("imaginary");
  });

  it("returns empty for projects without CLI evidence", () => {
    const commands = discoverCliCommands(tmpdir());
    expect(commands).toEqual([]);
  });

  it("is deterministic across runs", () => {
    const a = discoverCliCommands(FIXTURE);
    const b = discoverCliCommands(FIXTURE);
    expect(a).toEqual(b);
  });
});
