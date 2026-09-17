import type { CommentStandard } from "../../contracts/comment.js";
import type { FrameworkAssociation } from "../../contracts/framework.js";

/** Lockfile basenames identifying the Node.js ecosystem. */
export const NODE_ECOSYSTEM_LOCKFILES: readonly string[] = [
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lock",
  "bun.lockb",
];

/** Configuration file basenames recognised by the TypeScript adapter. */
export const TYPESCRIPT_CONFIG_FILES: readonly string[] = [
  "tsconfig.json",
  "tsconfig.build.json",
  "tsconfig.eslint.json",
  "tsconfig.node.json",
  "tsconfig.app.json",
];

/** Configuration file basenames recognised by the JavaScript adapter. */
export const JAVASCRIPT_CONFIG_FILES: readonly string[] = [
  "jsconfig.json",
  "babel.config.js",
  "babel.config.json",
  ".babelrc",
  ".babelrc.json",
];

/** Default entry point basenames for TypeScript. */
export const TYPESCRIPT_ENTRY_FILES: readonly string[] = [
  "index.ts",
  "main.ts",
  "app.ts",
  "server.ts",
];

/** Default entry point basenames for JavaScript. */
export const JAVASCRIPT_ENTRY_FILES: readonly string[] = [
  "index.js",
  "main.js",
  "app.js",
  "server.js",
];

/** The JSDoc documentation comment standard. */
export const JSDOC_COMMENT_STANDARD: CommentStandard = {
  id: "jsdoc",
  name: "JSDoc",
  style: "docblock",
  markers: ["/**", "*/"],
  description: "The de-facto standard documentation comment format for JavaScript.",
};

/** The TSDoc documentation comment standard. */
export const TSDOC_COMMENT_STANDARD: CommentStandard = {
  id: "tsdoc",
  name: "TSDoc",
  style: "docblock",
  markers: ["/**", "*/"],
  description: "A standard for TypeScript documentation comments.",
};

/** Framework associations declared by the TypeScript adapter. */
export const TYPESCRIPT_FRAMEWORKS: readonly FrameworkAssociation[] = [
  { id: "nextjs", name: "Next.js", dependencies: ["next"] },
  { id: "nestjs", name: "NestJS", dependencies: ["@nestjs/core"] },
  { id: "angular", name: "Angular", dependencies: ["@angular/core"] },
  { id: "remix", name: "Remix", dependencies: ["remix", "@remix-run/react"] },
  { id: "astro", name: "Astro", dependencies: ["astro"] },
  { id: "solidstart", name: "SolidStart", dependencies: ["solid-start"] },
];

/** Framework associations declared by the JavaScript adapter. */
export const JAVASCRIPT_FRAMEWORKS: readonly FrameworkAssociation[] = [
  { id: "express", name: "Express", dependencies: ["express"] },
  { id: "react", name: "React", dependencies: ["react"] },
  { id: "vue", name: "Vue", dependencies: ["vue"] },
  { id: "node", name: "Node.js", dependencies: ["node"] },
  { id: "hono", name: "Hono", dependencies: ["hono"] },
  { id: "fastify", name: "Fastify", dependencies: ["fastify"] },
];

/** Framework associations for the Node.js ecosystem (shared). */
export const NODE_FRAMEWORKS: readonly FrameworkAssociation[] = [
  ...TYPESCRIPT_FRAMEWORKS,
  ...JAVASCRIPT_FRAMEWORKS,
];
