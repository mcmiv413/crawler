# How to Add an Elemental Ring

Elemental rings are equipment-driven spell packages. A complete ring must cover content, core runtime, presenter/UI, generated indexes, and tests.

If the task is **only** adding or changing a spell inside the existing ring-magic system, start with [adding-ring-spell.md](adding-ring-spell.md). Come back to this guide when the work also adds a new ring item, new enchantment grant, or new school package.

Rings are associated with schools via `RING_SCHOOL_BY_ID`, which maps each ring's `itemId` to its school(s). Spells can belong to one or multiple schools; combo spells require multiple equipped schools and have `equippedSchool` requirements for each school.

Follow [Architecture Patterns](architecture-patterns.md): add source entity files, regenerate indexes, keep content static, keep runtime decisions in core/server, and expose display-ready state through the presenter.

## Quick Start

1. Add ring item content in `packages/content/src/items/armor/`.
2. Add any grant enchantment in `packages/content/src/enchantments/`.
3. Add spell metadata in `packages/content/src/ring-spells/` and runtime definitions in `packages/game-core/src/abilities/definitions/`.
4. Add status definitions in `packages/content/src/statuses/` when spells apply new statuses.
5. Add animation refs in `packages/content/src/animation-refs/` and modules in `apps/web/src/animations/modules/`.
6. Run `pnpm generate:indexes`.
7. Prove the 6-hop chain with tests, then run `pnpm validate`.

## Required Surfaces

| Surface | Files |
|---------|-------|
| Item | `packages/content/src/items/armor/<ring>.ts` |
| Ring school | `packages/content/src/ring-schools/<school>.ts`, plus `types.ts` if adding a new `RingSchool` union member |
| Enchantment grant | `packages/content/src/enchantments/<grant>.ts` |
| Ring spell | `packages/content/src/ring-spells/<spell>.ts` (includes study requirements and feeds generated `ABILITY_DEFINITIONS`) |
| Core spell runtime | `packages/game-core/src/abilities/definitions/<spell>.ts` |
| Magic progression tuning | `packages/content/src/balance/tables.ts` |
| Equipment grant/revoke | `packages/game-core/src/systems/equipment.ts` |
| Elder study | `packages/game-core/src/systems/town.ts` |
| Presenter | `packages/presenter/src/builders/player-hud-builder.ts`, `packages/presenter/src/builders/town-view-builder.ts` |
| UI | `apps/web/src/components/PlayerHud.tsx`, `apps/web/src/components/TownPhase.tsx` |
| Animations | `packages/content/src/animation-refs/<category>.ts`, `apps/web/src/animations/modules/<module>.ts` |

## Checklist

- The ring item has `armor.slot: 'ring'` and stable `itemId`.
- The ring school is defined in its own source file and appears in generated `RING_SCHOOL_BY_ID` with correct `ringId` mapping.
- The grant enchantment uses `effect: { type: 'grant_ability', abilityId }`.
- Ring spells are defined in source files with `schools`, `studyRequirements` (including `goldCost` and `minimumSchoolXp`), authored `manaCost`, `xpGainOnCast`, and any status effects.
- Ring spells are not duplicated under `packages/content/src/abilities/`; `pnpm generate:indexes` emits them into `ABILITY_DEFINITIONS` automatically.
- Cross-references use imported definitions or dot-walked refs where practical instead of repeated raw IDs.
- Generated indexes are updated by `pnpm generate:indexes`, not hand edits.
- Learned spells are stored in `player.learnedRingSpellIds` (source of truth).
- School mastery is tracked in `player.ringMastery[schoolId] = { xp }` (no spell unlock field).
- Studying is the paid unlock step only; `study_spell` learns the spell and charges gold but does not grant magic XP.
- Successful spell casts grant school XP through each spell's authored `xpGainOnCast` for every listed school on the spell.
- Global magic XP is derived from the total of all school XP, and mana growth comes from global magic level via `MAGIC.levelXpTable` and `MAGIC.manaPerMagicLevel`.
- Study thresholds come from `MAGIC.schoolMasteryTierThresholds`; presenter/UI code should consume presenter-owned progression data instead of hardcoding tier breakpoints, and school display levels keep growing after the last authored benefit tier.
- Equipping grants base and learned spells via `collectEquipmentAbilityGrants`; unequipping revokes only abilities no equipped source still grants.
- `USE_ABILITY` validates mana and spell eligibility before spending resources.
- Elder study uses `TOWN_ACTION` with `action: 'study_spell'` and `spellId`.
- Presenter exposes mana, spell costs, XP-per-cast, uncapped school display levels, readiness, and `TownView.studyableSpells` (filtered by equipped schools).
- UI renders mana, spell power, magic XP progress, the Character Screen Magic modal, and the Ring Study panel without `Max tier` copy.
- Contract tests validate item IDs, ring schools, spell IDs, cross-references, and animation refs.
- Unit/integration tests cover equip, cast, mana spend, low-mana rejection, study unlock without XP gain, cast-based school XP, global-magic mana scaling, centralized-threshold presenter/UI output, and combo spell requirements.
