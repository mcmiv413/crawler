# Documentation Guides

Reference docs for this codebase. Load these on-demand when working on specific tasks.

---

## ⚠️ Important: Auto-Index Generator

After adding new content (items, enemies, abilities, biomes, enchantments, quests, etc.), **always run**:

```bash
pnpm generate:indexes
```

This scans your content directories and automatically generates index files that make your content accessible via `@dungeon/content` exports. **Do not manually edit generated index files** — run the generator instead.

Each guide below includes a "Quick Start" section that reminds you to run this command.

---

| Guide | When to read |
|-------|-------------|
| [Architecture](guides/architecture.md) | Understanding the codebase, data flow, package responsibilities |
| [Nemesis + Factions Sequence Diagrams](guides/nemesis-factions-sequence-diagrams.md) | Tracing the current nemesis and faction systems end-to-end across engine, server, presenter, and UI |
| [Testing](guides/testing.md) | Writing tests, anti-patterns, helpers, balance testing |
| [How to Audit the Codebase](guides/how-to-audit.md) | Performing a rigorous structural audit and turning findings into a fix plan |
| [Audit Tooling Guide](guides/audit-tooling.md) | CLI paths, Serena/Fossil audit workflow, and external-semantics fallback |
| [Adding a Game Mechanic](guides/adding-mechanic.md) | Implementing a new system end-to-end (the 6-hop chain) |
| [Adding an Ability](guides/adding-ability.md) | Data-driven ability definitions and the execution pipeline |
| [Adding an Enemy](guides/adding-enemy.md) | Enemy templates, archetypes, spawning, AI behavior |
| [Adding a Biome](guides/adding-biome.md) | Biome definitions, map generation, visual theming |
| [Adding an Enchantment](guides/adding-enchantment.md) | Enchantment definitions, hook system, stacking rules |
| [UI Design](guides/ui-design.md) | Design system, colour tokens, sprite system, layout rules |
| [Maintaining Docs](MAINTAINING-DOCS.md) | How to update this documentation system |
