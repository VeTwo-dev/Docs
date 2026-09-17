import { describe, expect, it } from "vitest";
import { discoverPackages } from "./packages.js";
import { MemoryProvider } from "../providers/memory.js";

describe("discoverPackages", () => {
  it("discovers the root package", async () => {
    const provider = new MemoryProvider("/root", {
      files: {
        "package.json":
          '{"name":"root","version":"1.0.0","scripts":{"build":"tsup"},"dependencies":{"fast-glob":"^3"}}',
      },
    });
    const result = await discoverPackages(provider, "/root", []);
    expect(result.packages).toHaveLength(1);
    const root = result.packages[0];
    expect(root?.relativePath).toBe(".");
    expect(root?.isWorkspaceRoot).toBe(true);
    expect(root?.name).toBe("root");
    expect(root?.scripts).toEqual({ build: "tsup" });
    expect(root?.dependencies).toEqual({ "fast-glob": "^3" });
  });

  it("discovers workspace packages", async () => {
    const provider = new MemoryProvider("/root", {
      files: {
        "package.json": '{"name":"root","private":true}',
        "packages/a/package.json":
          '{"name":"a","version":"1.0.0","bin":{"a":"bin/a.js"},"peerDependencies":{"x":"^1"}}',
        "packages/b/package.json": '{"name":"b"}',
      },
    });
    const result = await discoverPackages(provider, "/root", ["packages/a", "packages/b"]);
    expect(result.packages.map((p) => p.relativePath)).toEqual([".", "packages/a", "packages/b"]);
    const a = result.packages.find((p) => p.relativePath === "packages/a");
    expect(a?.isWorkspaceRoot).toBe(false);
    expect(a?.bin).toEqual({ a: "bin/a.js" });
    expect(a?.peerDependencies).toEqual({ x: "^1" });
  });

  it("defaults package names when absent", async () => {
    const provider = new MemoryProvider("/root", {
      files: { "packages/a/package.json": "{}", "package.json": "{}" },
    });
    const result = await discoverPackages(provider, "/root", ["packages/a"]);
    const a = result.packages.find((p) => p.relativePath === "packages/a");
    expect(a?.name).toBe("a");
  });

  it("emits diagnostics for invalid manifests", async () => {
    const provider = new MemoryProvider("/root", {
      files: { "package.json": "not json", "packages/bad/package.json": "nope" },
    });
    const result = await discoverPackages(provider, "/root", ["packages/bad"]);
    expect(result.packages).toHaveLength(0);
    expect(result.diagnostics.map((d) => d.category)).toEqual([
      "invalid-manifest",
      "invalid-manifest",
    ]);
    expect(result.diagnostics[0]).toMatchObject({
      severity: "warning",
      source: "package-discovery",
    });
  });

  it("flags missing manifests only in strict mode", async () => {
    const provider = new MemoryProvider("/root", {
      files: { "package.json": "{}", "packages/empty/readme.md": "hi" },
    });
    const lax = await discoverPackages(provider, "/root", ["packages/empty"]);
    expect(lax.diagnostics).toHaveLength(0);
    const strict = await discoverPackages(provider, "/root", ["packages/empty"], { strict: true });
    expect(strict.diagnostics[0]?.category).toBe("missing-manifest");
  });

  it("warns on duplicate workspace directories", async () => {
    const provider = new MemoryProvider("/root", {
      files: { "package.json": "{}", "packages/a/package.json": "{}" },
    });
    const result = await discoverPackages(provider, "/root", ["packages/a", "packages/a"]);
    expect(result.diagnostics[0]?.category).toBe("circular-workspace");
  });
});
