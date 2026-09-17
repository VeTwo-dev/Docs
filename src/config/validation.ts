import { z } from "zod";
import { isSecretConfigKey } from "../utils/redact.js";

const ThemeConfigSchema = z
  .object({
    name: z.string().optional(),
    logo: z.string().optional(),
    favicon: z.string().optional(),
    cssOverrides: z.string().optional(),
  })
  .passthrough();

const NavItemSchema: z.ZodType<{
  label: string;
  href: string;
  items?: unknown[];
  badge?: string;
  external?: boolean;
}> = z.object({
  label: z.string(),
  href: z.string(),
  items: z.array(z.lazy(() => NavItemSchema)).optional(),
  badge: z.string().optional(),
  external: z.boolean().optional(),
});

const SidebarItemSchema: z.ZodType<{
  label: string;
  href?: string;
  items?: unknown[];
  collapsed?: boolean;
  badge?: string;
}> = z.object({
  label: z.string(),
  href: z.string().optional(),
  items: z.array(z.lazy(() => SidebarItemSchema)).optional(),
  collapsed: z.boolean().optional(),
  badge: z.string().optional(),
});

const SidebarConfigSchema = z
  .object({
    auto: z.boolean().optional(),
    groups: z
      .array(
        z.object({
          title: z.string(),
          items: z.array(SidebarItemSchema),
        }),
      )
      .optional(),
    collapsed: z.boolean().optional(),
  })
  .passthrough();

const SeoConfigSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    image: z.string().optional(),
    url: z.string().optional(),
    twitter: z.string().optional(),
  })
  .passthrough();

const SearchConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    indexFields: z.array(z.string()).optional(),
    maxResults: z.number().optional(),
  })
  .passthrough();

const VersioningConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    current: z.string().optional(),
    versions: z.array(z.string()).optional(),
  })
  .passthrough();

const MarkdownConfigSchema = z
  .object({
    gfm: z.boolean().optional(),
    breaks: z.boolean().optional(),
    pedantic: z.boolean().optional(),
    headerIds: z.boolean().optional(),
    toc: z.boolean().optional(),
    tocDepth: z.number().min(1).max(6).optional(),
    syntaxHighlighting: z.boolean().optional(),
    mdx: z.boolean().optional(),
    smartypants: z.boolean().optional(),
    raw: z.boolean().optional(),
    document: z.boolean().optional(),
    lineHighlighting: z.boolean().optional(),
    diffHighlighting: z.boolean().optional(),
    focusRegions: z.boolean().optional(),
  })
  .passthrough();

const ApiConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    source: z.string().optional(),
    include: z.array(z.string()).optional(),
    exclude: z.array(z.string()).optional(),
    readme: z.boolean().optional(),
  })
  .passthrough();

const RssOptionsSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    link: z.string().optional(),
    language: z.string().optional(),
  })
  .passthrough();

const OutputLayoutSchema = z
  .object({
    directory: z.string().min(1),
    layout: z
      .object({
        next: z.boolean(),
        markdown: z.boolean(),
        static: z.boolean(),
      })
      .optional(),
  })
  .passthrough();

const AgentSkillSchema = z
  .object({
    path: z.string().optional(),
  })
  .passthrough();

const AgentConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    skill: AgentSkillSchema.optional(),
  })
  .passthrough();

/**
 * Zod schema for validating user-provided documentation configuration.
 * Provides strong TypeScript inference and friendly error messages.
 */
export const DocsConfigSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    source: z.string().optional(),
    output: z.union([z.string(), OutputLayoutSchema]).optional(),
    baseUrl: z
      .string()
      .optional()
      .refine(
        (val) => {
          if (val === undefined || val === "") return true;
          // Allow relative URLs (starting with /) and absolute URLs
          if (val.startsWith("/")) return true;
          try {
            const url = new URL(val);
            return ["http:", "https:"].includes(url.protocol);
          } catch {
            return false;
          }
        },
        { message: "baseUrl must be a valid HTTP/HTTPS URL or start with /" },
      ),
    theme: z.union([z.string(), ThemeConfigSchema]).optional(),
    nav: z
      .object({
        items: z.array(NavItemSchema),
      })
      .optional(),
    sidebar: SidebarConfigSchema.optional(),
    seo: SeoConfigSchema.optional(),
    search: SearchConfigSchema.optional(),
    versioning: VersioningConfigSchema.optional(),
    sitemap: z.boolean().optional(),
    rss: z.boolean().optional(),
    rssOptions: RssOptionsSchema.optional(),
    robots: z.boolean().optional(),
    og: z.boolean().optional(),
    watch: z.boolean().optional(),
    clean: z.boolean().optional(),
    cache: z.boolean().optional(),
    ignore: z.array(z.string()).optional(),
    include: z.array(z.string()).optional(),
    rehypePlugins: z.array(z.string()).optional(),
    remarkPlugins: z.array(z.string()).optional(),
    plugins: z.array(z.any()).optional(),
    markdown: MarkdownConfigSchema.optional(),
    api: ApiConfigSchema.optional(),
    agent: AgentConfigSchema.optional(),
  })
  .passthrough();

export type ValidatedDocsConfig = z.infer<typeof DocsConfigSchema>;

/**
 * Validates user configuration input against the schema.
 * Returns the validated config or throws with friendly error messages.
 *
 * @param input - The raw user config input.
 * @returns The validated and typed configuration.
 * @throws If validation fails.
 */
export function validateConfig(input: unknown): ValidatedDocsConfig {
  const result = DocsConfigSchema.safeParse(input);
  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Configuration validation failed:\n${errors}`);
  }
  return result.data;
}

/**
 * Validates user configuration and returns warnings for deprecated or
 * non-standard fields without throwing.
 *
 * @param input - The raw user config input.
 * @returns An array of warning strings.
 */
export function validateConfigWarnings(input: unknown): readonly string[] {
  const warnings: string[] = [];
  const data = input as Record<string, unknown> | undefined;

  if (data && typeof data === "object") {
    if ("outputDir" in data) {
      warnings.push('Config field "outputDir" is deprecated. Use "output" instead.');
    }
    if ("docsDir" in data) {
      warnings.push('Config field "docsDir" is deprecated. Use "source" instead.');
    }
    if ("siteUrl" in data) {
      warnings.push('Config field "siteUrl" is deprecated. Use "baseUrl" instead.');
    }

    // Secret detection in config values
    for (const [key, value] of Object.entries(data)) {
      if (isSecretConfigKey(key) && typeof value === "string" && value.length > 0) {
        warnings.push(
          `Config field "${key}" appears to contain a secret. Consider using an environment variable instead.`,
        );
      }
    }
  }

  return warnings;
}
