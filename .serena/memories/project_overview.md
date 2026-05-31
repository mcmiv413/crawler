# Project Overview

**Name:** `dungeon-crawler-rpg` (aka `dungeon-rpg`), version 0.1.0, private.

## Purpose
A browser-based, turn-based dungeon crawler roguelike RPG with persistent world
consequences. Narrative enrichment and NPC dialogue are powered by a local LLM
(LM Studio), but the game is **fully playable offline** — AI is optional and
falls back to static content after a 2-second timeout.

## How the Game Works (domain model)
- **Goal:** Defeat the floor boss at dungeon floor >=5 and return to town alive.
- **Town phase:** explore, talk to NPCs, buy/sell at shop, upgrade skills, plan runs.
- **Dungeon phase:** clear procedurally-generated floors one at a time (turn-based
  exploration), fight enemies with action points + abilities, collect loot.
- **Combat:** turn-based — player acts, then all enemies act. Auto-attacks +
  abilities (Power Strike, Second Wind, etc.), status effects (burn, poison, slow,
  shock), element resistances.
- **Progression:** weapon masteries, enchanted items, named nemesis enemies that
  grow stronger, world state (prosperity/corruption/fear) affecting NPC behavior.
- **Permadeath:** losing all HP = game over; overkill damage (>50% max HP) is
  permanent. Cleared floors stay cleared.

## Featured Systems
Persistent world state (nemeses, floor cache, faction disposition), dual-weapon
swapping, equipment enchantments, 5 enemy ability types, 4 status effect types,
dynamic NPC dialogue (LM Studio + static fallback), procedural per-biome dungeon gen.

## Top-level layout
- `apps/` — `server` (Fastify API) and `web` (React SPA)
- `packages/` — `game-contracts`, `content`, `game-core`, `presenter`, `eslint-plugin-dungeon`
- `docs/` — guides (architecture, adding-* how-tos), audits, skills
- `scripts/` — guardrail checks, index generation, balance sims, reporters
- `tests/` — root-level e2e/integration/contract/balance tests

See also: [[tech_stack]], [[codebase_structure]], [[code_conventions]],
[[suggested_commands]], [[task_completion_checklist]], [[architecture_and_patterns]].
