---
memory_type: concept
status: active
---

# Project Overview

## Summary
`dungeon-crawler-rpg` (v0.1.0, private) is a browser-based, turn-based dungeon-crawler roguelike RPG with persistent world consequences. AI narrative enrichment via LM Studio is optional; the game is fully playable offline with static fallback content after a 2-second timeout.

## Durable Knowledge
- **Goal:** Defeat the floor boss at dungeon floor >=5 and return to town alive.
- **Town phase:** explore, talk to NPCs, buy/sell at shop, upgrade skills, plan runs.
- **Dungeon phase:** clear procedurally-generated floors (turn-based exploration), fight enemies with action points + abilities, collect loot.
- **Combat:** turn-based — player acts, then all enemies act. Auto-attacks + abilities (Power Strike, Second Wind, etc.), status effects (burn, poison, slow, shock), element resistances.
- **Progression:** weapon masteries, enchanted items, named nemesis enemies that grow stronger, world state (prosperity/corruption/fear) affecting NPC behavior.
- **Permadeath:** losing all HP = game over; overkill damage (>50% max HP) is permanent. Cleared floors stay cleared.
- **Featured systems:** persistent world state (nemeses, floor cache, faction disposition), dual-weapon swapping, equipment enchantments, 5 enemy ability types, 4 status effect types, dynamic NPC dialogue (LM Studio + static fallback), procedural per-biome dungeon generation.
- **Top-level layout:** `apps/` (server + web), `packages/` (game-contracts, content, game-core, presenter, eslint-plugin-dungeon), `docs/` (guides, audits, skills), `scripts/` (guardrail checks, index generation, balance sims, reporters), `tests/` (root-level e2e/integration/contract/balance tests).

## Evidence
- `apps/server/src/app.ts` — Fastify API entry point
- `apps/web/src/` — React SPA root
- `packages/game-contracts/src/types/game-state.ts` — canonical GameState type
- `packages/content/src/` — static game data (enemies, items, biomes, abilities)
- `docs/guides/architecture.md` — full architecture guide

## Relationships
- `architecture_and_patterns` — CQRS data flow and key design rules
- `codebase_structure` — full package and directory map
- `tech_stack` — language, runtime, and tooling choices
- `task_completion_checklist` — gate sequence before committing or merging

## Update Guidance
Update when core game rules change (new phase, permadeath rule change, new major system). Do not duplicate content-level details already covered in domain/* memories.
