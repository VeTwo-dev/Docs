import { extensionOf } from "../../languages/utils/extension.js";

/** Joins qualified-name segments, ignoring empty ones. */
export function joinQualifiedName(...parts: readonly (string | undefined)[]): string {
  return parts.filter((part) => typeof part === "string" && part.length > 0).join(".");
}

/** The module name for a file path: extension stripped, slashes as dots. */
export function moduleNameOf(file: string): string {
  const extension = extensionOf(file);
  const withoutExtension = extension.length > 0 ? file.slice(0, -extension.length) : file;
  return withoutExtension.replaceAll("/", ".").replaceAll("\\", ".");
}

/** The namespace path string for a list of namespace names. */
export function namespacePath(namespace: readonly string[]): string {
  return namespace.join(".");
}

/** Sanitizes a directory name into an identifier-safe package name. */
export function packageNameOf(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^_+|_+$/g, "") || "default";
}
