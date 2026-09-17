/**
 * Project Classifier.
 *
 * Infers project archetypes and documentation personas from compiler
 * input signals. A project may hold multiple archetypes at once
 * (`framework + library`, `cli + development-tool`); the classifier
 * never collapses them into one.
 */

import type { CompilerProjectInput, DocumentationPersona, ProjectArchetype } from "./types.js";

/** Result of classification. */
export interface ClassificationResult {
  readonly archetypes: readonly ProjectArchetype[];
  readonly personas: readonly { persona: DocumentationPersona; priority: number }[];
}

/**
 * Classify a project into one or more archetypes with evidence-based rules.
 * Order is stable; the most defining archetype comes first.
 */
export function classifyProject(input: CompilerProjectInput): ClassificationResult {
  const s = input.signals;
  const deps = s.dependencies ?? [];
  const peers = s.peerDependencies ?? [];
  const archetypes: ProjectArchetype[] = [];

  // ── Structural signals ────────────────────────────────────────────
  if (s.isMonorepo) archetypes.push("monorepo");

  // ── Delivery surface ──────────────────────────────────────────────
  if (s.hasBin || s.hasCli) archetypes.push("cli");

  const serverHints = [
    "express",
    "fastify",
    "koa",
    "hapi",
    "@nestjs/core",
    "@hapi/hapi",
    "apollo-server",
    "hono",
  ];
  const hasServerDep = serverHints.some((d) => deps.includes(d));
  if (s.hasServer || hasServerDep)
    archetypes.push(s.hasServer && !hasServerDep ? "backend" : "service");

  const reactLike = ["react", "preact", "vue", "svelte"].some(
    (d) => peers.includes(d) || deps.includes(d),
  );
  if (reactLike && (archetypes.includes("service") || s.hasServer)) archetypes.push("fullstack");
  else if (reactLike && isConsumerFacing(deps, s.exportsCount ?? 0)) archetypes.push("frontend");

  // Framework: peer-depends on a host runtime it extends.
  const frameworkHosts = ["react", "vue", "next", "express", "fastify"];
  const peerHost = frameworkHosts.some((d) => peers.includes(d));
  if (peerHost && (s.exportsCount ?? 0) > 0) archetypes.push("framework");

  // Plugin: named plugin packages / declared plugin surface, small exports.
  if ((s.plugins?.length ?? 0) > 0 || /^.*-(plugin|preset)$/.test(input.name)) {
    archetypes.push("plugin");
  }

  // Build tooling / compilers.
  const buildToolHints = ["rollup", "esbuild", "swc", "vite", "webpack", "@babel/core"];
  if (buildToolHints.some((d) => deps.includes(d)) && s.hasBin) archetypes.push("build-tool");
  if (deps.includes("typescript") && buildToolHints.some((d) => deps.includes(d))) {
    archetypes.push("compiler");
  }

  // Generator/template markers.
  if (/^(generator-|create-)/.test(input.name) || deps.includes("yeoman-generator")) {
    archetypes.push("generator");
    archetypes.push("template");
  }

  // SDK: exposes an API for external services.
  const sdkHints = ["axios", "got", "undici", "ky"];
  if (!archetypes.includes("framework") && sdkHints.some((d) => deps.includes(d)) && !s.hasBin) {
    archetypes.push("sdk");
  }

  // Runtime-ish: ships its own executable runtime surface.
  if (s.entryPoints !== undefined && s.entryPoints.length > 1 && !archetypes.includes("cli")) {
    archetypes.push("runtime");
  }

  // Base classification: library vs application vs tool.
  if (archetypes.length === 0) {
    if (isApplicationLike(deps, s.exportsCount ?? 0)) {
      archetypes.push("application");
    } else if ((s.exportsCount ?? 0) > 0) {
      archetypes.push("library");
    } else {
      archetypes.push("tool");
    }
  }
  if (
    (s.exportsCount ?? 0) > 0 &&
    !archetypes.includes("framework") &&
    !archetypes.includes("application")
  ) {
    // Most published packages are libraries even when also a CLI/tool.
    if (archetypes.includes("cli") || archetypes.includes("build-tool")) {
      if (!archetypes.includes("development-tool")) archetypes.push("development-tool");
    } else if (!archetypes.includes("sdk")) {
      archetypes.unshift("library");
    }
  }

  return {
    archetypes: [...new Set(archetypes)],
    personas: inferPersonas(archetypes, input),
  };
}

/**
 * Infer prioritized documentation personas from archetypes.
 * Priority 1 = primary audience.
 */
export function inferPersonas(
  archetypes: readonly ProjectArchetype[],
  input: CompilerProjectInput,
): { persona: DocumentationPersona; priority: number }[] {
  const personas = new Map<DocumentationPersona, number>();
  const add = (persona: DocumentationPersona) => {
    personas.set(persona, (personas.get(persona) ?? 0) + 1);
  };

  for (const archetype of archetypes) {
    switch (archetype) {
      case "library":
      case "sdk":
        add("developer");
        add("api-consumer");
        break;
      case "framework":
        add("application-developer");
        add("plugin-author");
        break;
      case "cli":
      case "tool":
      case "development-tool":
      case "build-tool":
        add("developer");
        add("contributor");
        break;
      case "backend":
      case "service":
      case "runtime":
        add("operator");
        add("developer");
        break;
      case "frontend":
      case "application":
      case "fullstack":
        add("end-user");
        add("developer");
        break;
      case "monorepo":
        add("maintainer");
        add("contributor");
        break;
      case "plugin":
        add("integrator");
        break;
      case "template":
      case "generator":
        add("developer");
        break;
      case "compiler":
        add("maintainer");
        add("contributor");
        break;
    }
  }

  const result = [...personas.entries()]
    .map(([persona, votes]) => ({ persona, priority: votes }))
    .sort((a, b) => b.priority - a.priority);

  // A description mentioning "users" nudges end-user relevance upward.
  if (input.description !== undefined && /user/i.test(input.description) && result.length > 0) {
    const idx = result.findIndex((p) => p.persona === "end-user");
    if (idx > 0) {
      const [entry] = result.splice(idx, 1);
      if (entry !== undefined) result.unshift(entry);
    }
  }

  return result.map((p, i) => ({ persona: p.persona, priority: i + 1 }));
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function isApplicationLike(deps: readonly string[], exportsCount: number): boolean {
  const appHints = ["next", "nuxt", "remix", "@remix-run/node", "astro", "svelte-kit"];
  return appHints.some((d) => deps.includes(d)) || (exportsCount === 0 && deps.length > 3);
}

function isConsumerFacing(deps: readonly string[], exportsCount: number): boolean {
  return exportsCount > 0 && !deps.includes("next");
}
