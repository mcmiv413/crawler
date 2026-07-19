# Documentation Guides

Reference docs for this codebase. Load these on-demand when working on specific tasks.

---

## ⚠️ Important: Auto-Index Generator

After adding new content (items, enemies, abilities, biomes, enchantments, quests, etc.), **always run**:

```bash
pnpm generate:indexes
```

This scans content directories and automatically generates index files that make content accessible via `@dungeon/content` exports. Add catalog data as individual source files, then run the generator. **Do not manually edit generated index files** — run the generator instead.

Each guide below includes a "Quick Start" section that reminds you to run this command.

---

| Guide | When to read |
|-------|-------------|
| [Architecture](guides/architecture.md) | Understanding the codebase, data flow, package responsibilities |
| [Architecture Patterns](guides/architecture-patterns.md) | Normative rules for layer ownership, entity files, generated indexes, refs, central pipelines, presenter views, migrations, and test layers |
| [Architecture Pattern Audit](guides/architecture-pattern-audit.md) | Classifying architecture drift, generated-index violations, stale docs, guardrail gaps, and bug logging for future sweeps |
| [Nemesis + Factions Sequence Diagrams](guides/nemesis-factions-sequence-diagrams.md) | Tracing the current nemesis and faction systems end-to-end across engine, server, presenter, and UI |
| [Testing](guides/testing.md) | Writing tests, anti-patterns, helpers, balance testing |
| [Feature Proof Registry](feature-proofs.yml) | Machine-readable feature ownership, proof homes, scenario fixtures, and focused validation commands |
| [Deterministic Proof Attestation](guides/deterministic-proof.md) | Current proofctl plan workflow, external verifier boundary, future validate/verify stages, attestation identities, and crawler policy data |
| [How to Audit the Codebase](guides/how-to-audit.md) | Performing a rigorous structural audit and turning findings into a fix plan |
| [Audit Tooling Guide](guides/audit-tooling.md) | CLI paths, audit workflow (Serena for symbol lookup, Fossil for leads), and external-semantics fallback |
| [Goofy Local Model](guides/goofy-local-model.md) | Syncing the live Goofy launcher, installing local Ollama aliases, and rerunning the backing-model benchmark |
| [Adding a Game Mechanic](guides/adding-mechanic.md) | Implementing a new system end-to-end (the 6-hop chain) |
| [Adding an Ability](guides/adding-ability.md) | Data-driven ability definitions and the execution pipeline |
| [Adding an Animation](guides/adding-animation.md) | Defining animation refs, required timing fields, and generator workflow |
| [Adding a Ring Spell](guides/adding-ring-spell.md) | Ring spell authoring, hidden escalation cases, and proof-home selection |
| [Adding an Enemy](guides/adding-enemy.md) | Enemy templates, archetypes, spawning, AI behavior |
| [Adding a Biome](guides/adding-biome.md) | Biome definitions, map generation, visual theming |
| [Adding an Enchantment](guides/adding-enchantment.md) | Enchantment definitions, hook system, stacking rules |
| [Adding an Elemental Ring](guides/adding-ring.md) | Ring-granted spells, Elder study unlocks, mana/mastery, animations, and tests |
| [Turn Animation Beat Model](guides/turn-animation.md) | Beat ordering, visible-only queue pacing, settle timing, and web scheduler tuning |
| [UI Design](guides/ui-design.md) | Design system, colour tokens, sprite system, layout rules |
| [Repo Skills Workflow](guides/repo-skills.md) | Canonical skill source, generated mirrors, PSRE capability map, and maintenance commands |
| [Maintaining Docs](MAINTAINING-DOCS.md) | How to update this documentation system |
| [Enhancements](enhancements/ENH-movement-discoverability.md) | Future UX or product improvements that are not current bugs |
