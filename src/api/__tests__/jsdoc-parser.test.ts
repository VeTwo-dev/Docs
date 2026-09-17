import { describe, it, expect } from "vitest";
import { parseDocComment } from "../jsdoc-parser.js";

describe("parseDocComment", () => {
  it("parses a simple summary", () => {
    const doc = parseDocComment("Creates a new user.");
    expect(doc.summary).toBe("Creates a new user.");
    expect(doc.params).toHaveLength(0);
    expect(doc.examples).toHaveLength(0);
  });

  it("parses @param tags", () => {
    const doc = parseDocComment(`
      Creates a user.

      @param name - The user's name
      @param age - The user's age
    `);
    expect(doc.summary).toBe("Creates a user.");
    expect(doc.params).toHaveLength(2);
    expect(doc.params[0]).toEqual({ name: "name", description: "The user's name" });
    expect(doc.params[1]).toEqual({ name: "age", description: "The user's age" });
  });

  it("parses @returns tag", () => {
    const doc = parseDocComment(`
      Gets a user.

      @returns The user object
    `);
    expect(doc.returns).toBe("The user object");
  });

  it("parses @example blocks", () => {
    const doc = parseDocComment(`
      Creates a user.

      @example
      ts
      const user = createUser("Alice");
      \`\`\`
    `);
    expect(doc.examples).toHaveLength(1);
    expect(doc.examples[0].language).toBe("ts");
    expect(doc.examples[0].code).toContain('const user = createUser("Alice")');
  });

  it("parses @deprecated tag", () => {
    const doc = parseDocComment(`
      Old function.

      @deprecated Use newFunction instead.
    `);
    expect(doc.deprecated).toBe("Use newFunction instead.");
  });

  it("parses @since tag", () => {
    const doc = parseDocComment(`
      New function.

      @since 2.0.0
    `);
    expect(doc.since).toBe("2.0.0");
  });

  it("parses @throws tags", () => {
    const doc = parseDocComment(`
      Validates input.

      @throws {ValidationError} If input is invalid
      @throws {Error} On network failure
    `);
    expect(doc.throws).toHaveLength(2);
    expect(doc.throws[0]).toEqual({ type: "ValidationError", description: "If input is invalid" });
    expect(doc.throws[1]).toEqual({ type: "Error", description: "On network failure" });
  });

  it("parses @see references", () => {
    const doc = parseDocComment(`
      Creates a user.

      @see createUser
      @see [Documentation](https://example.com)
    `);
    expect(doc.see).toHaveLength(2);
    expect(doc.see[0]).toEqual({ text: "createUser" });
    expect(doc.see[1]).toEqual({ text: "Documentation", url: "https://example.com" });
  });

  it("parses @link references from summary", () => {
    const doc = parseDocComment(
      "Creates a user. See {@link PaginatedList} for pagination.",
    );
    expect(doc.links).toHaveLength(1);
    expect(doc.links[0].target).toBe("PaginatedList");
  });

  it("handles multi-line descriptions", () => {
    const doc = parseDocComment(`
      Creates a new user in the system.
      This function handles all the setup
      and validation needed.
    `);
    expect(doc.summary).toContain("Creates a new user");
    expect(doc.summary).toContain("validation needed");
  });

  it("returns empty doc for empty input", () => {
    const doc = parseDocComment("");
    expect(doc.summary).toBe("");
    expect(doc.params).toHaveLength(0);
    expect(doc.examples).toHaveLength(0);
    expect(doc.throws).toHaveLength(0);
    expect(doc.see).toHaveLength(0);
    expect(doc.links).toHaveLength(0);
  });
});
