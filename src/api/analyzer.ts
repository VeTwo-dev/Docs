/**
 * Semantic API Analyzer.
 *
 * Uses the TypeScript Compiler API to perform full semantic analysis of
 * public API surfaces. Produces {@link ApiSymbol} instances with resolved
 * types, generic constraints, heritage chains, and parsed documentation.
 *
 * Supports both TypeScript (`.ts`, `.tsx`) and JavaScript (`.js`, `.jsx`)
 * files — JavaScript files use TypeScript's inference engine to derive
 * types from JSDoc annotations.
 *
 * This module operates independently from the compiler layer's normalized
 * syntax trees and symbol extractors. It creates its own `ts.Program` for
 * full type checker access.
 */

import { existsSync } from "node:fs";
import { hashString } from "../utils/hash.js";
import type {
  ApiSymbol,
  ApiSymbolKind,
  ApiAnalysisResult,
  ApiParameter,
  ApiTypeParameter,
  ApiMember,
  ApiEnumMember,
  ApiAccess,
  ApiBoundary,
  ApiDocComment,
} from "./models.js";
import { parseDocComment } from "./jsdoc-parser.js";
import { formatType } from "./type-formatter.js";

// TypeScript is loaded dynamically — it's an optional peer dependency.
type TS = typeof import("typescript");

/** Extensions analyzed by the semantic analyzer. */
const ANALYZABLE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs"]);

/** Options for the semantic analyzer. */
export interface SemanticAnalyzerOptions {
  /** Root directory of the project. */
  readonly rootDir: string;
  /** Path to tsconfig.json (optional — auto-detected if not provided). */
  readonly tsconfigPath?: string;
  /** Entry points to analyze (file globs or paths). If empty, uses tsconfig include. */
  readonly entryPoints?: readonly string[];
  /** Whether to include internal symbols (default: false). */
  readonly includeInternal?: boolean;
  /** Maximum depth for class/interface member extraction. */
  readonly maxMemberDepth?: number;
  /** Files to exclude from analysis. */
  readonly exclude?: readonly string[];
}

/** Load the TypeScript module dynamically. */
async function loadTypeScript(): Promise<TS | undefined> {
  try {
    return await import("typescript");
  } catch {
    return undefined;
  }
}

/** Detect tsconfig.json in the project root. */
function findTsconfig(rootDir: string): string | undefined {
  const candidates = ["tsconfig.json", "tsconfig.base.json", "jsconfig.json"];
  for (const candidate of candidates) {
    const path = rootDir + "/" + candidate;
    if (existsSync(path)) return path;
  }
  return undefined;
}

async function discoverFallbackFiles(rootDir: string, _ts: TS): Promise<string[]> {
  try {
    const fg = await import("fast-glob");
    const glob = (fg as unknown as { globSync: (p: string[], o: unknown) => string[] }).globSync ?? (fg as unknown as { default: { globSync: (p: string[], o: unknown) => string[] } }).default?.globSync;
    if (glob) {
      const files = glob(["src/**/*.{ts,tsx,js,jsx}", "lib/**/*.{ts,tsx}"], { cwd: rootDir, absolute: true, ignore: ["**/*.test.*", "**/*.spec.*", "**/__tests__/**", "node_modules/**", "dist/**"] });
      return files.slice(0, 200);
    }
  } catch {}
  return [];
}

/** Directories that are never source code (generated output, build, deps). */
const ALWAYS_EXCLUDED = ["node_modules/", "dist/", "build/", "coverage/", ".vetwo/", ".git/"];

/** Directories excluded unless explicitly requested (generated docs, fixtures). */
const DEFAULT_EXCLUDED = ["docs/", "wiki/", "fixtures/", "examples/"];

/** Determine if a file should be analyzed. */
function shouldAnalyze(filePath: string, exclude: readonly string[]): boolean {
  const ext = filePath.slice(filePath.lastIndexOf("."));
  if (!ANALYZABLE_EXTENSIONS.has(ext)) return false;
  const normalized = filePath.replace(/\\/g, "/");
  for (const dir of ALWAYS_EXCLUDED) {
    if (normalized.includes(dir)) return false;
  }
  for (const pattern of exclude) {
    if (normalized.includes(pattern.replace(/\*/g, ""))) return false;
  }
  return true;
}

/** Whether a tsconfig-provided absolute file should enter the program. */
function keepProgramFile(absolutePath: string, rootDir: string, exclude: readonly string[]): boolean {
  const normalized = absolutePath.replace(/\\/g, "/");
  const rel = normalized.startsWith(rootDir) ? normalized.slice(rootDir.length + 1) : normalized;
  for (const dir of [...ALWAYS_EXCLUDED, ...DEFAULT_EXCLUDED]) {
    if (rel === dir.replace(/\/$/, "") || rel.startsWith(dir)) return false;
  }
  return shouldAnalyze(rel, exclude);
}

/** Classify an API symbol's boundary based on name conventions and modifiers. */
function classifyBoundary(
  symbol: import("typescript").Symbol,
  ts: TS,
): ApiBoundary {
  const name = symbol.getName();
  if (name.startsWith("_")) return "internal";
  const tags = symbol.getJsDocTags(undefined);
  const hasInternal = tags.some(
    (t) => t.name === "internal" || t.name === "private" || t.name === "protected",
  );
  if (hasInternal) return "internal";
  const declarations = symbol.getDeclarations();
  if (declarations !== undefined && declarations.length > 0) {
    const decl = declarations[0];
    const modFlags = ts.getCombinedModifierFlags(decl as import("typescript").Declaration);
    if (modFlags & ts.ModifierFlags.Private) return "private";
    if (modFlags & ts.ModifierFlags.Protected) return "semi-public";
  }
  return "public";
}

/** Extract the relative path from an absolute path. */
function relativePath(absolutePath: string, rootDir: string): string {
  if (absolutePath.startsWith(rootDir)) {
    return absolutePath.slice(rootDir.length + 1);
  }
  return absolutePath;
}

/**
 * Analyze a TypeScript/JavaScript project for its public API surface.
 *
 * @param options - Analysis options.
 * @returns The analysis result with all API symbols and lookup indices.
 */
export async function analyzeAPIs(options: SemanticAnalyzerOptions): Promise<ApiAnalysisResult> {
  const ts = await loadTypeScript();
  if (ts === undefined) {
    throw new Error(
      'The "typescript" package is required for semantic API analysis. ' +
        'Install it with: npm install typescript',
    );
  }

  const rootDir = options.rootDir;
  const tsconfigPath = options.tsconfigPath ?? findTsconfig(rootDir);

  let program: import("typescript").Program;
  if (tsconfigPath !== undefined) {
    const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
    if (configFile.error !== undefined) {
      throw new Error(
        `Failed to read tsconfig: ${ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n")}`,
      );
    }
    const parsed = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      rootDir,
      undefined,
      undefined,
    );
    const listed = parsed.fileNames.length > 0 ? parsed.fileNames : await discoverFallbackFiles(rootDir, ts);
    // tsconfig include patterns (or their **/* default) can match generated
    // output, build dirs and fixtures — never analyze those as source.
    const fileNames = listed.filter((f) => keepProgramFile(f, rootDir, options.exclude ?? []));
    program = ts.createProgram(fileNames, parsed.options);
  } else {
    const defaultOptions: import("typescript").CompilerOptions = {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      declaration: true,
    };
    const fileNames = await discoverFallbackFiles(rootDir, ts);
    program = ts.createProgram(fileNames, defaultOptions);
  }

  const checker = program.getTypeChecker();
  const exclude = options.exclude ?? [];
  const sourceFiles = program.getSourceFiles().filter(
    (sf) =>
      !sf.isDeclarationFile &&
      shouldAnalyze(relativePath(sf.fileName, rootDir), exclude),
  );

  const symbols: ApiSymbol[] = [];

  for (const sourceFile of sourceFiles) {
    const filePath = relativePath(sourceFile.fileName, rootDir);
    ts.forEachChild(sourceFile, (node) => {
      extractTopLevelSymbols(node, ts, checker, sourceFile, filePath, rootDir, symbols, options);
    });
  }

  const symbolsById = new Map<string, ApiSymbol>();
  const symbolsByName = new Map<string, ApiSymbol>();
  const fileHashes = new Map<string, string>();

  for (const sym of symbols) {
    symbolsById.set(sym.id, sym);
    symbolsByName.set(sym.qualifiedName, sym);
  }

  for (const sf of sourceFiles) {
    const filePath = relativePath(sf.fileName, rootDir);
    fileHashes.set(filePath, hashString(sf.text));
  }

  return {
    symbols,
    symbolsById,
    symbolsByName,
    files: sourceFiles.map((sf) => relativePath(sf.fileName, rootDir)),
    analyzedAt: new Date().toISOString(),
    fileHashes,
  };
}

/** Extract top-level exported symbols from a declaration node. */
function extractTopLevelSymbols(
  node: import("typescript").Node,
  ts: TS,
  checker: import("typescript").TypeChecker,
  sourceFile: import("typescript").SourceFile,
  filePath: string,
  rootDir: string,
  symbols: ApiSymbol[],
  options: SemanticAnalyzerOptions,
): void {
  if (!isExported(node, ts, sourceFile)) {
    if (!options.includeInternal) return;
  }

  const nameNode = getNameNode(node, ts);
  if (nameNode === undefined) return;
  const symbol = checker.getSymbolAtLocation(nameNode);
  if (symbol === undefined) return;

  try {
    const apiSymbol = convertSymbol(symbol, node, ts, checker, sourceFile, filePath, rootDir, options);
    if (apiSymbol !== undefined) symbols.push(apiSymbol);
  } catch {
    // Skip symbols that fail semantic analysis
  }
}

/** Get the name node of a declaration. */
function getNameNode(node: import("typescript").Node, ts: TS): import("typescript").Node | undefined {
  if (
    ts.isFunctionDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isEnumDeclaration(node) ||
    ts.isVariableDeclaration(node) ||
    ts.isModuleDeclaration(node)
  ) {
    return node.name;
  }
  if (ts.isExportAssignment(node)) {
    return node.expression;
  }
  return undefined;
}

/** Check if a node is exported. */
function isExported(node: import("typescript").Node, ts: TS, _sourceFile: import("typescript").SourceFile): boolean {
  if (ts.isExportAssignment(node)) return true;
  if (ts.canHaveModifiers(node)) {
    const modifiers = ts.getModifiers(node);
    if (modifiers !== undefined) {
      for (const mod of modifiers) {
        if (mod.kind === ts.SyntaxKind.ExportKeyword) return true;
      }
    }
  }
  return false;
}

/** Convert a TypeScript symbol into an ApiSymbol. */
function convertSymbol(
  symbol: import("typescript").Symbol,
  node: import("typescript").Node,
  ts: TS,
  checker: import("typescript").TypeChecker,
  sourceFile: import("typescript").SourceFile,
  filePath: string,
  rootDir: string,
  options: SemanticAnalyzerOptions,
): ApiSymbol | undefined {
  const name = symbol.getName();
  if (name === "default" || name === "__proto__") return undefined;

  const kind = classifyKind(node, symbol, checker, ts);
  if (kind === undefined) return undefined;

  const qualifiedName = buildQualifiedName(symbol, checker, ts, filePath);
  const id = hashString(`${qualifiedName}:${filePath}`);
  const location = getSymbolLocation(symbol, sourceFile);
  const docs = extractDocumentation(symbol, checker, ts);
  const boundary = classifyBoundary(symbol, ts);

  const type = checker.getTypeOfSymbolAtLocation(symbol, node);

  const jsDocTags = symbol.getJsDocTags(checker);
  const deprecatedTag = jsDocTags.find((t) => t.name === "deprecated");
  const deprecated =
    deprecatedTag !== undefined
      ? deprecatedTag.text !== undefined && deprecatedTag.text.length > 0
        ? ts.displayPartsToString(deprecatedTag.text)
        : true
      : false;

  const sinceTag = jsDocTags.find((t) => t.name === "since");
  const since =
    sinceTag !== undefined && sinceTag.text !== undefined
      ? ts.displayPartsToString(sinceTag.text)
      : undefined;

  const base: Omit<ApiSymbol, "kind" | "members" | "enumMembers" | "parameters" | "overloads" | "returnType" | "typeParameters" | "extends" | "implements"> = {
    id,
    name,
    qualifiedName,
    documentation: docs,
    sourceFile: filePath,
    line: location.line,
    column: location.column,
    exported: true,
    deprecated,
    since,
    boundary,
  };

  switch (kind) {
    case "function":
    case "method": {
      const sig = type.getCallSignatures()[0];
      const parameters = sig !== undefined ? extractParameters(sig, checker, ts) : undefined;
      const returnType =
        sig !== undefined ? formatType(sig.getReturnType(), checker, { maxDepth: 4 }) : undefined;
      const typeParams = sig !== undefined ? extractTypeParameters(sig, ts) : undefined;
      const overloads = extractOverloads(symbol, ts, checker, sourceFile, filePath, rootDir, options);
      return { ...base, kind, parameters, returnType, typeParameters: typeParams, overloads: overloads.length > 0 ? overloads : undefined };
    }

    case "class": {
      const members = extractClassMembers(symbol, ts, checker, sourceFile, filePath, rootDir, options);
      let extendsType: string | undefined;
      try {
        const classType = type as import("typescript").InterfaceType;
        const baseTypes = checker.getBaseTypes(classType);
        extendsType = baseTypes.length > 0 ? checker.typeToString(baseTypes[0] as import("typescript").Type) : undefined;
      } catch { extendsType = undefined; }
      // Get implemented interfaces from the class declaration
      const implementsTypes: string[] = [];
      if (ts.isClassDeclaration(node) && node.heritageClauses !== undefined) {
        for (const clause of node.heritageClauses) {
          if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
            for (const typeArg of clause.types) {
              implementsTypes.push(typeArg.getText());
            }
          }
        }
      }
      const ctorSig = type.getConstructSignatures()[0];
      const parameters = ctorSig !== undefined ? extractParameters(ctorSig, checker, ts) : undefined;
      const typeParams = extractTypeParametersFromClass(node, ts);
      return { ...base, kind: "class", members, extends: extendsType, implements: implementsTypes.length > 0 ? implementsTypes : undefined, parameters, typeParameters: typeParams };
    }

    case "interface": {
      const members = extractInterfaceMembers(symbol, ts, checker, sourceFile, filePath, rootDir, options);
      let extendsType: string | undefined;
      try {
        const ifaceType = type as import("typescript").InterfaceType;
        const baseTypes = checker.getBaseTypes(ifaceType);
        extendsType = baseTypes.length > 0 ? checker.typeToString(baseTypes[0] as import("typescript").Type) : undefined;
      } catch { extendsType = undefined; }
      const typeParams = extractTypeParametersFromClass(node, ts);
      return { ...base, kind: "interface", members, extends: extendsType, typeParameters: typeParams };
    }

    case "type-alias": {
      const aliasedType = checker.typeToString(type);
      const typeParams = extractTypeParametersFromClass(node, ts);
      return { ...base, kind: "type-alias", returnType: aliasedType, typeParameters: typeParams };
    }

    case "enum": {
      const enumMembers = extractEnumMembers(node, ts, checker);
      return { ...base, kind: "enum", enumMembers };
    }

    case "variable":
    case "constant": {
      const varType = formatType(type, checker, { maxDepth: 4 });
      return { ...base, kind, returnType: varType };
    }

    default:
      return undefined;
  }
}

/** Classify the kind of a symbol based on its declaration. */
function classifyKind(
  node: import("typescript").Node,
  _symbol: import("typescript").Symbol,
  _checker: import("typescript").TypeChecker,
  ts: TS,
): ApiSymbolKind | undefined {
  if (ts.isFunctionDeclaration(node)) return "function";
  if (ts.isClassDeclaration(node)) return "class";
  if (ts.isInterfaceDeclaration(node)) return "interface";
  if (ts.isTypeAliasDeclaration(node)) return "type-alias";
  if (ts.isEnumDeclaration(node)) return "enum";
  if (ts.isVariableDeclaration(node)) {
    // Check if the variable has a `const` modifier
    const isConst = ts.canHaveModifiers(node) &&
      ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ConstKeyword);
    return isConst ? "constant" : "variable";
  }
  if (ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) return "method";
  if (ts.isConstructorDeclaration(node)) return "constructor";
  if (ts.isGetAccessorDeclaration(node)) return "getter";
  if (ts.isSetAccessorDeclaration(node)) return "setter";
  if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) return "property";
  return undefined;
}

/** Build a qualified name for a symbol. */
function buildQualifiedName(symbol: import("typescript").Symbol, checker: import("typescript").TypeChecker, ts: TS, _filePath: string): string {
  const parent = symbol.getDeclarations()?.[0]?.parent;
  if (parent !== undefined && ts.isModuleBlock(parent)) {
    const parentSymbol = checker.getSymbolAtLocation(parent.parent.name);
    if (parentSymbol !== undefined) {
      return `${parentSymbol.getName()}.${symbol.getName()}`;
    }
  }
  return symbol.getName();
}

/** Get the source location of a symbol. */
function getSymbolLocation(
  symbol: import("typescript").Symbol,
  sourceFile: import("typescript").SourceFile,
): { line: number; column: number } {
  const declarations = symbol.getDeclarations();
  if (declarations !== undefined && declarations.length > 0) {
    const pos = declarations[0]!.getStart(sourceFile, false);
    const lineAndChar = sourceFile.getLineAndCharacterOfPosition(pos);
    return { line: lineAndChar.line + 1, column: lineAndChar.character + 1 };
  }
  return { line: 1, column: 1 };
}

/** Extract documentation from a symbol's JSDoc comments. */
function extractDocumentation(symbol: import("typescript").Symbol, checker: import("typescript").TypeChecker, ts: TS): ApiDocComment {
  const declarations = symbol.getDeclarations();
  if (declarations !== undefined && declarations.length > 0) {
    const sourceFile = declarations[0]!.getSourceFile();
    const fullText = sourceFile.getFullText();
    const parsed = getLeadingJSDocComment(declarations[0]!, fullText, ts);
    if (parsed !== undefined) {
      return parseDocComment(parsed);
    }
  }
  const commentParts = symbol.getDocumentationComment(checker);
  const rawComment = ts.displayPartsToString(commentParts);
  return {
    summary: rawComment,
    params: [],
    examples: [],
    throws: [],
    see: [],
    links: [],
    tags: {},
    raw: rawComment,
  };
}

/** Extract the leading JSDoc comment from a node's source text. */
function getLeadingJSDocComment(node: import("typescript").Node, fullText: string, ts: TS): string | undefined {
  const nodeStart = node.getFullStart();
  const commentRanges = ts.getLeadingCommentRanges(fullText, nodeStart);
  if (commentRanges === undefined) return undefined;
  for (const range of commentRanges) {
    const commentText = fullText.slice(range.pos, range.end);
    if (commentText.startsWith("/**")) {
      return commentText.slice(3, -2);
    }
  }
  return undefined;
}

/** Extract parameters from a signature. */
function extractParameters(signature: import("typescript").Signature, checker: import("typescript").TypeChecker, ts: TS): ApiParameter[] {
  return signature.getParameters().map((param) => {
    const decl2 = (param.valueDeclaration ?? param.getDeclarations()?.[0]) as import("typescript").Node | undefined;
    const paramType: import("typescript").Type = decl2 !== undefined
      ? checker.getTypeOfSymbolAtLocation(param, decl2)
      : checker.getTypeAtLocation(param.valueDeclaration! as unknown as import("typescript").Node);
    const isOptional = (param.flags & ts.SymbolFlags.Optional) !== 0;
    const isRest = param.valueDeclaration !== undefined && ts.isParameter(param.valueDeclaration) && !!param.valueDeclaration.dotDotDotToken;
    let defaultValue: string | undefined;
    if (param.valueDeclaration !== undefined && ts.isParameter(param.valueDeclaration) && param.valueDeclaration.initializer !== undefined) {
      defaultValue = param.valueDeclaration.initializer.getText();
    }
    const jsDocTags = param.getJsDocTags(checker);
    const paramDoc = jsDocTags.find((t) => t.name === "param");
    const description =
      paramDoc !== undefined && paramDoc.text !== undefined
        ? ts.displayPartsToString(paramDoc.text)
        : "";
    return {
      name: param.getName(),
      type: formatType(paramType, checker, { maxDepth: 3 }),
      description,
      required: !isOptional && !isRest,
      defaultValue,
      rest: isRest,
    };
  });
}

/** Extract type parameters from a signature. */
function extractTypeParameters(signature: import("typescript").Signature, _ts: TS): ApiTypeParameter[] | undefined {
  const typeParams = signature.getTypeParameters();
  if (typeParams === undefined || typeParams.length === 0) return undefined;
  return typeParams.map((tp) => {
    const c = tp.getConstraint();
    const d = tp.getDefault();
    return {
      name: tp.symbol.getName(),
      constraint: c !== undefined ? String((c as unknown as { getText?: () => string }).getText?.() ?? c) : undefined,
      default: d !== undefined ? String((d as unknown as { getText?: () => string }).getText?.() ?? d) : undefined,
    };
  });
}

/** Extract type parameters from a class/interface/type-alias declaration. */
function extractTypeParametersFromClass(node: import("typescript").Node, ts: TS): ApiTypeParameter[] | undefined {
  let typeParams: readonly import("typescript").TypeParameterDeclaration[] | undefined;
  if (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
    typeParams = node.typeParameters;
  }
  if (typeParams === undefined || typeParams.length === 0) return undefined;
  return typeParams.map((tp) => ({
    name: tp.name.getText(),
    constraint: tp.constraint !== undefined ? tp.constraint.getText() : undefined,
    default: tp.default !== undefined ? tp.default.getText() : undefined,
  }));
}

/** Extract overloaded call signatures from a symbol. */
function extractOverloads(
  symbol: import("typescript").Symbol,
  ts: TS,
  checker: import("typescript").TypeChecker,
  _sourceFile: import("typescript").SourceFile,
  filePath: string,
  _rootDir: string,
  _options: SemanticAnalyzerOptions,
): ApiSymbol[] {
  const decl = symbol.getDeclarations()?.[0] as import("typescript").Node | undefined;
  if (decl === undefined) return [];
  const type = checker.getTypeOfSymbolAtLocation(symbol, decl);
  const signatures = type.getCallSignatures();
  if (signatures.length <= 1) return [];
  return signatures.map((sig, index) => {
    const parameters = extractParameters(sig, checker, ts);
    const returnType = formatType(sig.getReturnType(), checker, { maxDepth: 4 });
    const typeParams = extractTypeParameters(sig, ts);
    return {
      id: hashString(`${symbol.getName()}:overload:${index}:${filePath}`),
      name: symbol.getName(),
      qualifiedName: `${buildQualifiedName(symbol, checker, ts, filePath)}:overload:${index}`,
      kind: "function" as ApiSymbolKind,
      parameters,
      returnType,
      typeParameters: typeParams,
      documentation: { summary: "", params: [], examples: [], throws: [], see: [], links: [], tags: {}, raw: "" },
      sourceFile: filePath,
      line: 1,
      column: 1,
      exported: true,
      deprecated: false,
      boundary: "public" as ApiBoundary,
    };
  });
}

/** Extract members from a class. */
function extractClassMembers(
  classSymbol: import("typescript").Symbol,
  ts: TS,
  checker: import("typescript").TypeChecker,
  _sourceFile: import("typescript").SourceFile,
  _filePath: string,
  _rootDir: string,
  _options: SemanticAnalyzerOptions,
): ApiMember[] {
  const members: ApiMember[] = [];
  const declarations = classSymbol.getDeclarations();
  if (declarations === undefined || declarations.length === 0) return members;
  const classDecl = declarations[0]!;
  if (!ts.isClassDeclaration(classDecl)) return members;

  for (const member of classDecl.members) {
    const mn = (member as { name?: import("typescript").Node }).name;
    if (mn === undefined) continue;
    const memberSymbol = checker.getSymbolAtLocation(mn as import("typescript").Node);
    if (memberSymbol === undefined) continue;
    const memberKind = classifyMemberKind(member, ts);
    if (memberKind === undefined) continue;

    const memberType = checker.getTypeOfSymbolAtLocation(memberSymbol!, member as import("typescript").Node);
    const memberDocs = extractDocumentation(memberSymbol, checker, ts);

    const modifiers = ts.canHaveModifiers(member) ? ts.getModifiers(member) : undefined;
    const access: ApiAccess =
      modifiers?.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword) ? "private"
      : modifiers?.some((m) => m.kind === ts.SyntaxKind.ProtectedKeyword) ? "protected"
      : "public";
    const isStatic = modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword) ?? false;
    const isReadonly = modifiers?.some((m) => m.kind === ts.SyntaxKind.ReadonlyKeyword) ?? false;

    const jsDocTags = memberSymbol.getJsDocTags(checker);
    const deprecatedTag = jsDocTags.find((t) => t.name === "deprecated");
    const deprecated =
      deprecatedTag !== undefined
        ? deprecatedTag.text !== undefined && deprecatedTag.text.length > 0
          ? ts.displayPartsToString(deprecatedTag.text)
          : true
        : false;

    let signature = formatType(memberType, checker, { maxDepth: 3 });
    let parameters: ApiParameter[] | undefined;
    let returnType: string | undefined;
    const callSignatures = memberType.getCallSignatures();
    if (callSignatures.length > 0) {
      const sig = callSignatures[0] as import("typescript").Signature;
      if (sig === undefined) continue;
      parameters = extractParameters(sig, checker, ts);
      returnType = formatType(sig.getReturnType(), checker, { maxDepth: 4 });
      signature = formatSignatureDisplay(memberSymbol.getName(), parameters, returnType);
    }

    let required = true;
    if (ts.isPropertyDeclaration(member) || ts.isPropertySignature(member)) {
      required = (member as import("typescript").PropertyDeclaration).questionToken === undefined && (member as import("typescript").PropertySignature).questionToken === undefined;
    }

    const pos = member.getStart(member.getSourceFile(), false);
    const lineAndChar = member.getSourceFile().getLineAndCharacterOfPosition(pos);

    members.push({
      name: memberSymbol.getName(),
      kind: memberKind,
      signature,
      description: memberDocs.summary,
      tags: memberDocs.tags,
      required,
      static: isStatic,
      readonly: isReadonly,
      access,
      type: formatType(memberType, checker, { maxDepth: 3 }),
      returnType,
      parameters,
      line: lineAndChar.line + 1,
      column: lineAndChar.character + 1,
      deprecated,
    });
  }
  return members;
}

/** Classify the kind of a class member. */
function classifyMemberKind(member: import("typescript").ClassElement, ts: TS): ApiMember["kind"] | undefined {
  if (ts.isMethodDeclaration(member) || ts.isMethodSignature(member)) return "method";
  if (ts.isConstructorDeclaration(member)) return "constructor";
  if (ts.isGetAccessorDeclaration(member)) return "getter";
  if (ts.isSetAccessorDeclaration(member)) return "setter";
  if (ts.isPropertyDeclaration(member) || ts.isPropertySignature(member)) return "property";
  return undefined;
}

/** Extract members from an interface. */
function extractInterfaceMembers(
  ifaceSymbol: import("typescript").Symbol,
  ts: TS,
  checker: import("typescript").TypeChecker,
  _sourceFile: import("typescript").SourceFile,
  _filePath: string,
  _rootDir: string,
  _options: SemanticAnalyzerOptions,
): ApiMember[] {
  const members: ApiMember[] = [];
  const declarations = ifaceSymbol.getDeclarations();
  if (declarations === undefined || declarations.length === 0) return members;
  const ifaceDecl = declarations[0]!;
  if (!ts.isInterfaceDeclaration(ifaceDecl)) return members;

  for (const member of ifaceDecl.members) {
    const mn2 = (member as { name?: import("typescript").Node }).name;
    if (mn2 === undefined) continue;
    const memberSymbol = checker.getSymbolAtLocation(mn2 as import("typescript").Node);
    if (memberSymbol === undefined) continue;
    const memberKind = classifyMemberKind(member as unknown as import("typescript").ClassElement, ts);
    if (memberKind === undefined) continue;

    const memberType = checker.getTypeOfSymbolAtLocation(memberSymbol!, member as import("typescript").Node);
    const memberDocs = extractDocumentation(memberSymbol, checker, ts);
    const memberLocation = getSymbolLocation(memberSymbol, member.getSourceFile());

    const isReadonly = ts.canHaveModifiers(member as unknown as import("typescript").HasModifiers) &&
      ts.getModifiers(member as unknown as import("typescript").HasModifiers)?.some((m) => m.kind === ts.SyntaxKind.ReadonlyKeyword);

    let signature = formatType(memberType, checker, { maxDepth: 3 });
    let parameters: ApiParameter[] | undefined;
    let returnType: string | undefined;
    const callSignatures = memberType.getCallSignatures();
    if (callSignatures.length > 0) {
      const sig = callSignatures[0] as import("typescript").Signature;
      if (sig === undefined) continue;
      parameters = extractParameters(sig, checker, ts);
      returnType = formatType(sig.getReturnType(), checker, { maxDepth: 4 });
      signature = formatSignatureDisplay(memberSymbol.getName(), parameters, returnType);
    }

    let required = true;
    if (ts.isPropertySignature(member)) {
      required = (member as import("typescript").PropertySignature).questionToken === undefined;
    }

    members.push({
      name: memberSymbol.getName(),
      kind: memberKind,
      signature,
      description: memberDocs.summary,
      tags: memberDocs.tags,
      required,
      static: false,
      readonly: isReadonly === true,
      access: "public",
      type: formatType(memberType, checker, { maxDepth: 3 }),
      returnType,
      parameters,
      line: memberLocation.line,
      column: memberLocation.column,
      deprecated: false,
    });
  }
  return members;
}

/** Extract enum members with values. */
function extractEnumMembers(node: import("typescript").Node, ts: TS, _checker: import("typescript").TypeChecker): ApiEnumMember[] {
  if (!ts.isEnumDeclaration(node)) return [];
  return node.members.map((member) => {
    const name = member.name.getText();
    const value = member.initializer !== undefined ? member.initializer.getText() : member.name.getText();
    const location = member.getSourceFile().getLineAndCharacterOfPosition(member.getStart(member.getSourceFile(), false));
    let description = "";
    const jsDoc = getLeadingJSDocComment(member, member.getSourceFile().getFullText(), ts);
    if (jsDoc !== undefined) {
      const parsed = parseDocComment(jsDoc);
      description = parsed.summary;
    }
    return { name, value, description, line: location.line + 1 };
  });
}

/** Format a method/function signature for display. */
function formatSignatureDisplay(name: string, parameters: ApiParameter[], returnType: string): string {
  const params = parameters
    .map((p) => {
      const parts = [p.rest ? "..." : "", p.name];
      if (!p.required) parts.push("?");
      if (p.type !== "any") parts.push(`: ${p.type}`);
      return parts.join("");
    })
    .join(", ");
  return `${name}(${params}): ${returnType}`;
}
