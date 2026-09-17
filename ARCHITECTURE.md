# Architecture

@vetwo/docs is a production-grade documentation platform for JavaScript and TypeScript projects.

## Layered Architecture

```
CLI (Commander)
  → Engine (Service Container)
    → Pipeline (8-stage lifecycle)
      → Domain Layers (Scanner, Languages, Compiler, Symbols, References, Graph, etc.)
        → Utilities (hash, html, async, filesystem)
```

**Dependency rule:** Lower layers never depend on higher layers.

## Core Modules

| Module | Purpose |
|--------|---------|
| `scanner/` | Universal project scanner with ignore rules, file classification, watch mode |
| `languages/` | Language adapter system (TypeScript, JavaScript) with 21 capabilities |
| `compiler/` | Universal compiler layer (TypeScript, Babel) with lazy native loading |
| `symbols/` | Symbol extraction engine with deterministic IDs |
| `references/` | Name-level reference resolution with scope tracking |
| `graph/` | Universal knowledge graph with serialization |
| `documentation/compiler/` | Documentation knowledge compiler → Documentation IR |
| `renderers/` | IR → site rendering (Next.js, MDX, static HTML) |
| `content/` | Content authoring with ownership, three-way merge, safe composition |
| `ai/` | Pluggable AI documentation providers with anti-hallucination |
| `incremental/` | Continuous project intelligence (fingerprints, snapshots, change detection) |
| `state/` | Centralized state management under `.vetwo/docs/` |
| `init/` | Documentation workspace bootstrap with conflict detection |

## Data Flow

```
Project Source
  → Scanner (file discovery, classification)
  → Languages (adapter selection)
  → Compiler (AST parsing, diagnostics)
  → Symbols (extraction)
  → References (resolution)
  → Graph (knowledge graph)
  → Documentation Compiler (architecture → IR)
  → AI Provider (optional enrichment)
  → Content Composition (merge with user content)
  → Design System (theme, styles, fonts)
  → Renderers (Next.js, MDX, static HTML)
  → Output (written to disk)
```

## Documentation IR

The Documentation Intermediate Representation is the sole contract between the compiler and renderers. It is versioned, immutable, and renderer-independent.

```typescript
interface DocumentationIR {
  schemaVersion: 1;
  sections: IRSection[];
  pages: IRPage[];
  navigation: IRNavigation;
}
```

IR blocks: `heading`, `paragraph`, `code`, `list`, `callout`, `table`, `image`, `horizontal-rule`, `custom`.

## State Management

All engine state lives under `.vetwo/docs/`:

```
.vetwo/docs/
  state.json          # Root manifest (schema version, engine version)
  compiler/           # Compiler cache + manifest
  snapshots/          # Project snapshots for incremental builds
  graph/              # Incremental change graph
  ai/                 # AI provider state
  generated/          # Generated artifact metadata
```

## Provider Agnosticism

Core never imports OpenAI, Anthropic, Gemini, Ollama, or any specific AI provider. Providers are discovered and loaded dynamically behind the provider registry.

## Renderer Agnosticism

The documentation intelligence layer never imports Next.js, React, or any specific CSS framework. Renderers consume only the Documentation IR.

## Non-Destructive Generation

Every generated artifact has an ownership policy (`generated`, `user-owned`, `shared`, `protected`). User content is never silently overwritten.

## Incremental Intelligence

The incremental engine tracks:
- File fingerprints (SHA-256)
- Project snapshots
- Change detection (create, modify, delete, rename)
- Impact analysis (which docs are affected)
- Only affected documentation is regenerated
