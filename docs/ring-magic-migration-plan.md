# Ring Magic Migration Plan

## Context

The ring magic system scaffolding (Phases 1-13) added the new generic architecture — `learnedRingSpellIds`, `RingSpellDefinition`, `studyRequirements`, `RING_SPELL_BY_ID` — but never cut over the live game path. The game still runs through the old fire-specific model: `ringMastery.fire.spellsUnlocked`, `getFireRingStudySpell`, `unlockFireSpell`. This plan finishes the migration end-to-end across 8 broken integration points.

---

## Phase 1 — Contracts: generalize RingMasteryState

**File:** `packages/game-contracts/src/types/player.ts`

Change `RingMasteryState` from:
```ts
interface RingMasteryState { readonly fire?: { xp: number; spellsUnlocked: readonly string[] } }
```
To:
```ts
export type RingMasteryState = Record<string, { readonly xp: number }>
```
`spellsUnlocked` is removed — `learnedRingSpellIds` (already on `Player`) is the sole source of truth for learned spells.

**File:** `packages/game-contracts/src/types/schema-version.ts`
Bump `CURRENT_SCHEMA_VERSION` to `4`. Add history entry:
```
// v4: ringMastery shape → Record<school, {xp}>, spellsUnlocked removed (use learnedRingSpellIds)
```

---

## Phase 2 — game-core: generalize magic-xp helpers

**File:** `packages/game-core/src/systems/magic-xp.ts`

Replace `gainFireXp(player, amount)` with:
```ts
export function gainSchoolXp(player: Player, school: string, amount: number): Player {
  const current = player.ringMastery[school] ?? { xp: 0 };
  const newXp = current.xp + amount;
  const newMasteryLevel = Math.floor(newXp / MAGIC.fireMasteryThreshold);
  const newMaxMana = MAGIC.initialMana + newMasteryLevel * MAGIC.manaPerMasteryTier;
  return {
    ...player,
    maxMana: Math.max(player.maxMana, newMaxMana),
    ringMastery: { ...player.ringMastery, [school]: { xp: newXp } },
  };
}
```

Replace `unlockFireSpell(player, spellId)` with:
```ts
export function learnRingSpell(player: Player, spellId: string): Player {
  if (player.learnedRingSpellIds.includes(spellId)) return player;
  return { ...player, learnedRingSpellIds: [...player.learnedRingSpellIds, spellId] };
}
```

Update `getFireMasteryLevel` to read from generic ringMastery:
```ts
export function getFireMasteryLevel(player: Player): number {
  return Math.floor((player.ringMastery['fire']?.xp ?? 0) / MAGIC.fireMasteryThreshold);
}
```
All other fire-specific effect functions (`getFireBurnDuration`, `getFireBurnMagnitude`, etc.) keep using `getFireMasteryLevel` — they are intentionally fire-specific.

**File:** `packages/game-core/src/engine/handlers/combat.ts` (line ~70603)
Change: `gainFireXp(newState.player, MAGIC.fireXpPerBurningKill)` → `gainSchoolXp(newState.player, 'fire', MAGIC.fireXpPerBurningKill)`

---

## Phase 3 — game-core: equipment grants and town study

**File:** `packages/game-core/src/systems/equipment.ts` (line ~64831)

Replace fire-specific grant check:
```ts
// OLD:
const fireMastery = player.ringMastery.fire ?? { xp: 0, spellsUnlocked: [] };
if (fireMastery.spellsUnlocked.includes(spellId)) grants.add(spellId);
// NEW:
if (player.learnedRingSpellIds.includes(spellId)) grants.add(spellId);
```

**File:** `packages/game-core/src/systems/town.ts`

Rewrite `processStudySpell` to use the new path:
- Import `getStudySpell` from `@dungeon/content` (re-exported from ring-schools/utilities)
- Import `meetsStudyRequirement` from `../abilities/runtime/ring-spell-availability.js`
- Import `learnRingSpell` from `./magic-xp.js`
- Remove imports: `getFireRingStudySpell`, `unlockFireSpell`

New logic:
1. `getStudySpell(spellId)` — look up spell from `RING_SPELL_BY_ID`
2. Build `equippedItemIds` (string itemIds, not EntityIds) from equipment slots + itemRegistry
3. For each `req` in `spell.studyRequirements`: `meetsStudyRequirement(req, player, equippedItemIds)` — return early if any fails
4. `player.learnedRingSpellIds.includes(spellId)` — already learned, return early
5. Extract `goldCost` from the `goldCost` kind requirement
6. Apply: `learnRingSpell({ ...player, gold: player.gold - goldCost }, spellId)` then `syncEquipmentGrantedAbilities`
7. Emit `GOLD_CHANGED` + `SPELL_UNLOCKED` events (unchanged)

---

## Phase 4 — game-core: remove execute-ability bypass

**File:** `packages/game-core/src/abilities/runtime/execute-ability.ts` (line ~44)

Remove the `hasLearningSystem` guard entirely. Always enforce ring spell eligibility for any spell in `RING_SPELL_BY_ID`:
```ts
const ringSpell = RING_SPELL_BY_ID.get(ability.id);
if (ringSpell !== undefined) {
  const equippedItemIds = Object.values(state.player.equipment)
    .filter((id): id is EntityId => id !== null)
    .map(entityId => state.itemRegistry.items.get(entityId)?.itemId)
    .filter((id): id is string => id !== undefined);
  if (!canUseLearnedRingSpell(state.player, ability.id, equippedItemIds)) {
    return { state, events: [] };
  }
}
```
A new player with `learnedRingSpellIds: []` correctly cannot use ring spells.

---

## Phase 5 — content: delete legacy fire study table

**File:** `packages/content/src/abilities/utilities.ts`

Delete:
- `RingSpellStudyDefinition` interface
- `FIRE_RING_STUDY_SPELLS` constant (has stale costs that conflict with new spell definitions)
- `getFireRingStudySpell()` function

Keep: `getStudySpell`, `getSchoolForRing`, `getSpellsForRing` (already re-exported, generic).

---

## Phase 6 — presenter: generic TownView spell shape

**File:** `packages/presenter/src/game-view.ts`
- Remove `LearnableSpellView` interface (has fire-named fields `requiredFireXp`, `currentFireXp`)
- Remove `learnableSpells?: readonly LearnableSpellView[]` from `TownView`
- Add `studyableSpells?: readonly RingSpellView[]` to `TownView` (reuses existing generic interface)

**File:** `packages/presenter/src/builders/town-view-builder.ts`

Replace `buildLearnableSpells` (fire-hardcoded) with generic function that:
1. Finds equipped ring slots, maps to school via `getSchoolForRing`
2. Filters `RING_SPELL_BY_ID` to spells belonging to equipped schools
3. Maps each spell to `RingSpellView` shape (same logic already used in player-hud-builder.ts `studyableSpells` section — extract shared helper or replicate)

Update `buildTownView` to set `studyableSpells: buildTownStudyableSpells(state)`.

---

## Phase 7 — UI: CharacterScreen ring spell section

**File:** `apps/web/src/components/CharacterScreen.tsx`

After the existing info-buttons section, add ring magic display (only when `player.ringSchoolMasteries.length > 0` OR `player.learnedSpells.length > 0`):

```tsx
{player.ringSchoolMasteries.length > 0 && (
  <section style={{ marginBottom: 12 }}>
    <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>RING MAGIC</div>
    {player.ringSchoolMasteries.map(m => (
      <div key={m.school} style={{ fontSize: 12, color: '#cc8', marginBottom: 2 }}>
        {m.school} — Lv {m.level} ({m.xp} XP{m.nextLevelXp != null ? ` / ${m.nextLevelXp}` : ''})
      </div>
    ))}
  </section>
)}
{player.learnedSpells.length > 0 && (
  <section style={{ marginBottom: 12 }}>
    <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>LEARNED SPELLS</div>
    {player.learnedSpells.map(spell => (
      <div key={spell.spellId} style={{ fontSize: 12, color: '#8cf', marginBottom: 2 }}>
        {spell.name}
        {spell.manaCost > 0 && <span style={{ color: '#66f', marginLeft: 4 }}>{spell.manaCost}MP</span>}
        {spell.cooldown > 0 && <span style={{ color: '#888', marginLeft: 4 }}>cd:{spell.cooldown}</span>}
      </div>
    ))}
  </section>
)}
```

---

## Phase 8 — UI: PlayerHud compact mana guard

**File:** `apps/web/src/components/PlayerHud.tsx` (compact HUD, line ~200)

Change to conditional grid and guard MP bar:
```tsx
<div style={{
  display: 'grid',
  gridTemplateColumns: hasMana ? 'repeat(3, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))',
  gap: 4,
}}>
  <StatBar label="HP" ... />
  <StatBar label="XP" ... />
  {hasMana && <StatBar label="MP" ... />}
</div>
```

---

## Phase 9 — Contract tests

**File:** `tests/contracts/ring-magic.contract.test.ts`

Add live imports:
```ts
import { RING_SPELL_BY_ID, RING_SCHOOL_BY_ID, ABILITY_DEFINITIONS, STATUS_DEFINITIONS } from '@dungeon/content';
import { createTestPlayer } from '@dungeon/core/testing';
```

Uncomment and implement all 16+ assertions:
- Every spell has non-empty `schools` array
- Every spell has valid `effectKind`
- Every `statusId` in `statusEffects` exists in `STATUS_DEFINITIONS`
- Every spell exists in `ABILITY_DEFINITIONS`
- Every school has unique id and ringId
- New players have `learnedRingSpellIds: []`
- `ringMastery` entries are `{ xp }` only, no `spellsUnlocked`

---

## Phase 10 — Test fixture cleanup

Remove `spellsUnlocked` from all test fixtures (field no longer exists on `RingMasteryState`). Update assertions that checked `ringMastery.fire.spellsUnlocked` to check `learnedRingSpellIds` instead.

Affected files:
- `packages/game-core/src/systems/magic-xp.test.ts` — full rewrite to `gainSchoolXp`/`learnRingSpell` API
- `packages/game-core/src/systems/town.test.ts` — fixtures + assertions
- `packages/game-core/src/systems/equipment.test.ts` — remove `spellsUnlocked` from fixture
- `packages/game-core/src/systems/burn-spread.test.ts` — remove `spellsUnlocked` from fixture
- `packages/game-core/src/engine/command-handler.test.ts` — remove `spellsUnlocked` from fixture
- `packages/presenter/src/builders/town-view-builder.test.ts` — update `learnableSpells` → `studyableSpells` expectations

---

## Phase 11 — Docs

**File:** `docs/guides/adding-ring.md`  
Remove references to `ringMastery.<element>.spellsUnlocked` and enchantment grants via `spellsUnlocked`. Document that `learnedRingSpellIds` is the source of truth for known spells; `ringMastery` tracks XP only.

---

## Verification

```bash
pnpm vitest run packages/game-core/src/systems/magic-xp.test.ts
pnpm vitest run packages/game-core/src/systems/town.test.ts
pnpm vitest run packages/game-core/src/systems/equipment.test.ts
pnpm vitest run tests/contracts/ring-magic.contract.test.ts
pnpm validate
```

Done when:
- `ring-magic.contract.test.ts` has zero commented-out assertions
- No remaining `spellsUnlocked` references anywhere in the codebase
- `FIRE_RING_STUDY_SPELLS` and `LearnableSpellView` are deleted
- `CharacterScreen` renders ring mastery + learned spells sections when present
- Compact HUD hides MP bar when `maxMana === 0`
