# Scope & Boundaries

This page clarifies what the Story as Code specification covers — and what it intentionally leaves to other layers.

## What the Spec Defines

The specification defines a **declarative JSON-LD format** for describing worlds as temporal graphs. Concretely, it covers:

The specification is organized into four layers:

### World Layer

- **Graph structure** — Node and edge types, properties, and temporal states
- **Time system** — Defines how time works in a world (linear, cyclical, branching, relative)
- **Temporal model** — Frames as alternative timelines/branches forming a frame graph
- **World rules** — Constraints as declarative assertions with scope filters and severity levels

### Narrative Layer

- **Narrative configuration** — Lenses (perspective, knowledge, voice, reliability)
- **Story beats** — Hierarchical narrative building blocks with reveals and transitions
- **Narrative devices** — Rhetorical connections between beats (foreshadowing, red herrings, etc.)
- **Thematic threads** — Horizontal chaining of themes and motifs across storylines
- **Output formats** — Format definitions with structural hierarchy and pacing rules
- **Variant model** — Canon, speculative, retcon, fork, and collab variants

### Definitions Layer

- **Tags** — Reusable tag definitions for categorization
- **Types** — Extensible type definitions for classification of nodes and edges
- **Values** — Controlled vocabulary definitions

### Derivation Layer

- **Derivation** — Container for compiled outputs linked to world and narrative elements
- **Renderings** — Specific text outputs combining one lens with one format
- **Sections** — Structural units mirroring the format hierarchy
- **Passages** — Leaf-level prose content with beat links and inline annotations

## What the Spec Does Not Define

The following concerns are **intentionally out of scope**. They belong to tooling, implementations, or ecosystem layers built on top of the specification.

### File System Layout

The spec defines **what** is valid (ontology + shapes), not **where** files are stored. A conforming story can be a single `story.jsonld` with everything inline, or a multi-file project with `@id` references pointing to any directory structure. How files are organized on disk is a tooling and user-preference concern — the spec is layout-agnostic.

### Storage & Persistence

The spec does not prescribe how or where files are stored. It is storage-agnostic — a conforming implementation could use a file system, a database, an object store, or any other backend.

### Error Analysis & Story Validation

The spec provides the **building blocks** for validation — the Constraint schema defines declarative rules with severity levels, and the Derivation Layer tracks compiled outputs back to their source graph. However, the spec does not define:

- **How** constraints are evaluated (graph traversal algorithms, query engines)
- **Which** semantic story problems to detect (plot holes, dead characters with later edges, orphaned subplots, causal chain gaps, unreachable subgraphs)
- **When** validation runs (on save, in CI, on demand)

These are concerns of a **story linter** or **world analyzer** — tooling that reads the graph and applies rules, both user-defined constraints and built-in heuristics. The spec gives such tools a stable schema to work against, but the analysis logic itself is out of scope.

### Derivation & Compilation

The spec defines **what** a derivation is (renderings, sections, passages) and **what** it requires (lens + beats + format + graph state), but not **how** the derivation is produced. The compilation process — selecting nodes, resolving knowledge filters, applying pacing rules, generating prose or panels or audio — is a tooling concern.

Different implementations may use LLMs, template engines, procedural generation, or manual authoring to produce derivations. The spec only requires that the result is accompanied by valid derivation data linking it back to its source graph.

### Tooling & Developer Experience

The spec does not define CLI commands, editor integrations, visualization tools, or any other developer-facing tooling. Examples of tooling that implementations may provide:

- **CLI** — `story init`, `story validate`, `story derive`, `story diff`
- **Editor support** — Schema-aware autocompletion, graph visualization, timeline views
- **CI/CD integration** — Constraint checks as pipeline steps
- **Collaboration** — Merge conflict resolution for graph files, variant management workflows

The spec aims to be a stable foundation that tooling can build on without being coupled to any specific tool's design decisions.
