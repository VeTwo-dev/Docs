import type * as ts from "typescript";
import type { TypeScriptModule } from "./native.js";

/**
 * Syntactically extracts module specifiers from a TypeScript source file:
 * import/export declarations, import-equals, require calls and dynamic
 * imports. This is not semantic analysis — only the raw specifier strings.
 */
export function extractTsModuleSpecifiers(
  sourceFile: ts.SourceFile,
  ts: TypeScriptModule,
): readonly string[] {
  const specifiers: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (moduleSpecifier !== undefined && ts.isStringLiteral(moduleSpecifier)) {
        specifiers.push(moduleSpecifier.text);
      }
    } else if (ts.isImportEqualsDeclaration(node)) {
      const reference = node.moduleReference;
      if (ts.isExternalModuleReference(reference)) {
        const expression = reference.expression;
        if (expression !== undefined && ts.isStringLiteral(expression)) {
          specifiers.push(expression.text);
        }
      }
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const argument = node.arguments[0];
      if (argument !== undefined && ts.isStringLiteral(argument)) {
        const isRequire = ts.isIdentifier(callee) && callee.text === "require";
        const isDynamicImport =
          callee.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(callee) && callee.text === "import");
        if (isRequire || isDynamicImport) specifiers.push(argument.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return specifiers;
}
