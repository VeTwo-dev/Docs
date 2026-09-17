/** Syntactically extracts module specifiers from a Babel AST. */
export function extractBabelModuleSpecifiers(body: readonly unknown[]): readonly string[] {
  const specifiers: string[] = [];
  const visit = (node: unknown): void => {
    if (node === null || typeof node !== "object") return;
    const record = node as {
      type?: unknown;
      source?: unknown;
      callee?: unknown;
      arguments?: unknown;
      expression?: unknown;
    };
    const type = typeof record.type === "string" ? record.type : "";
    if (
      type === "ImportDeclaration" ||
      type === "ExportNamedDeclaration" ||
      type === "ExportAllDeclaration"
    ) {
      const source = record.source;
      if (source !== null && typeof source === "object") {
        const value = (source as { value?: unknown }).value;
        if (typeof value === "string") specifiers.push(value);
      }
    }
    // Babel 8 represents dynamic import() as a dedicated ImportExpression
    // node with a `source` field (previously CallExpression + Import callee).
    if (type === "ImportExpression") {
      const source = record.source;
      if (source !== null && typeof source === "object") {
        const value = (source as { value?: unknown }).value;
        if (typeof value === "string") specifiers.push(value);
      }
    }
    if (type === "CallExpression") {
      const callee = record.callee;
      const arguments_ = record.arguments;
      if (
        Array.isArray(arguments_) &&
        arguments_.length > 0 &&
        callee !== null &&
        typeof callee === "object"
      ) {
        const calleeRecord = callee as { type?: unknown; name?: unknown };
        const isRequire = calleeRecord.type === "Identifier" && calleeRecord.name === "require";
        const isDynamicImport =
          calleeRecord.type === "Import" ||
          (calleeRecord.type === "Identifier" && calleeRecord.name === "import");
        if (isRequire || isDynamicImport) {
          const argument = arguments_[0];
          if (
            argument !== null &&
            typeof argument === "object" &&
            (argument as { type?: unknown }).type === "StringLiteral"
          ) {
            const value = (argument as { value?: unknown }).value;
            if (typeof value === "string") specifiers.push(value);
          }
        }
      }
    }
    for (const key of Object.keys(record)) {
      const value = (record as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        for (const item of value) visit(item);
      } else {
        visit(value);
      }
    }
  };
  for (const statement of body) visit(statement);
  return specifiers;
}
