import { describe, it, expect } from "vitest";
import { babelKindFor, typeScriptKindFor, UNKNOWN_SYMBOL_KIND } from "./kind.js";

describe("typeScriptKindFor", () => {
  it("maps TypeScript node kinds to symbol kinds", () => {
    expect(typeScriptKindFor("FunctionDeclaration")).toBe("function");
    expect(typeScriptKindFor("ClassDeclaration")).toBe("class");
    expect(typeScriptKindFor("InterfaceDeclaration")).toBe("interface");
    expect(typeScriptKindFor("EnumMember")).toBe("enum-member");
    expect(typeScriptKindFor("Parameter")).toBe("parameter");
    expect(typeScriptKindFor("PropertyDeclaration")).toBe("property");
  });

  it("returns unknown for unmapped kinds", () => {
    expect(typeScriptKindFor("SourceFile")).toBe(UNKNOWN_SYMBOL_KIND);
    expect(typeScriptKindFor("Nope")).toBe(UNKNOWN_SYMBOL_KIND);
  });
});

describe("babelKindFor", () => {
  it("maps Babel node types to symbol kinds", () => {
    expect(babelKindFor("ClassMethod")).toBe("method");
    expect(babelKindFor("ClassProperty")).toBe("property");
    expect(babelKindFor("VariableDeclarator")).toBe("variable");
    expect(babelKindFor("Identifier")).toBe("parameter");
  });

  it("returns unknown for unmapped types", () => {
    expect(babelKindFor("Program")).toBe(UNKNOWN_SYMBOL_KIND);
  });
});
