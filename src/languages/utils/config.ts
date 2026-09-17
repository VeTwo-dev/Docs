import type { LanguageModel } from "../models/language.js";

/** Unions the configuration file basenames declared by the given languages. */
export function configurationFiles(languages: readonly LanguageModel[]): readonly string[] {
  return [...new Set(languages.flatMap((language) => language.configFiles))];
}

/** Unions the default entry file basenames declared by the given languages. */
export function entryPointFiles(languages: readonly LanguageModel[]): readonly string[] {
  return [...new Set(languages.flatMap((language) => language.entryFiles))];
}

/** Whether `name` matches a language's configuration files. */
export function matchesConfigurationFile(name: string, language: LanguageModel): boolean {
  return (
    language.configFiles.includes(name) ||
    language.fileNames.includes(name) ||
    language.configuration.some((config) => config.files.includes(name))
  );
}

/** Whether `name` is a declared default entry file of the language. */
export function matchesEntryFile(name: string, language: LanguageModel): boolean {
  return language.entryFiles.includes(name);
}
