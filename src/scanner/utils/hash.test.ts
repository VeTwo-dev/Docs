import { describe, expect, it } from "vitest";
import { hashContent, hashText, pathToId } from "./hash.js";

describe("hashText / hashContent", () => {
  it("produces stable sha1 hashes", () => {
    expect(hashText("hello world")).toBe("2aae6c35c94fcfb415dbe95f408b9ce91ee846ed");
    expect(hashText("hello world")).toBe(hashText("hello world"));
    expect(hashText("hello world")).not.toBe(hashText("hello world!"));
    expect(hashContent(Buffer.from("hello world", "utf8"))).toBe(hashText("hello world"));
  });
});

describe("pathToId", () => {
  it("produces a cleaned, stable identifier", () => {
    expect(pathToId("src/index.ts")).toBe("src/index.ts");
    expect(pathToId("./src/index.ts")).toBe("src/index.ts");
  });
});
