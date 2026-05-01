# How to Add a New Faction

## Overview

Factions are groups of enemies in the dungeon that evolve through player encounters. Each faction progresses through three states as the player defeats members and engages with them: **leaderless** → **led** (after a leader emerges) → **broken** (after the leader is slain). When all faction leaders are eliminated, the **Dungeon Ogre** emerges as the final threat.

---

## Quick Start

1. Create `packages/content/src/factions/my-faction.ts`
2. Define leader pools (names, titles) and leader template
3. Run `pnpm generate:indexes` — the index is auto-generated
4. Test progression logic and commit

---

## Step 1: Create the Definition with Leader Configuration

Create `packages/content/src/factions/my-faction.ts`:

```typescript
import type { FactionDefinition } from './types.js';

export const myFaction: FactionDefinition = {
  id: 'goblin_warband',
  name: 'Goblin Warband',
  description: 'Disorganized raiders motivated by greed and chaos.',
  lore: 'Once a loose rabble of cave-dwellers, these goblins have grown emboldened by the dungeon\'s depths. They hoard treasures and lay crude traps in the warrens they inhabit.',
  
  initialPower: 40,              // Starting power level (0-100)
  initialDisposition: -30,       // Starting attitude toward player (-100 to +100)
  
  // Leader configuration: pools for random generation when faction advances to "led"
  leaderNamePool: ['Grugg', 'Snarglak', 'Borguk', 'Thrakka'],
  leaderTitlePool: ['the Warlord', 'the Destroyer', 'the Scourge'],
  leaderTemplateId: 'goblin_warlord',  // Enemy template for the leader
};
```

### Configuration Fields

| Field | Purpose |
|-------|---------|
| `initialPower` | Starting power level (0–100); higher = stronger faction |
| `initialDisposition` | Starting attitude (-100 = hostile, +100 = friendly) |
| `leaderNamePool` | Names randomly chosen when leader emerges |
| `leaderTitlePool` | Titles randomly chosen when leader emerges |
| `leaderTemplateId` | Enemy template used when leader appears |

---

## Step 2: Understand Faction Progression

### Faction States

1. **Leaderless**: Faction has no leader. Defeated members damage faction power.
2. **Led**: A leader emerges after enough members die to leaderless faction. Now the leader represents the faction.
3. **Broken**: Leader is slain by the player. Faction is defeated and no longer responds to player deaths.

### Power and Events

- **Player kills faction member**: Faction power decreases by `FACTION_CONFIG.power.memberKillPowerLoss` (typically -1)
- **Player dies to leaderless faction member**: 
  - If faction power > 0 and no leader exists → **FACTION_LEADER_EMERGED** event (leader spawns at random depth)
  - Faction power increases by `FACTION_CONFIG.power.playerDeathPowerGain` (typically +20)
  - Faction status changes to `'led'`
- **Player dies to led faction leader**:
  - Faction power increases by `FACTION_CONFIG.power.playerDeathWithLeaderPowerGain` (typically +8)
  - No leader emergence event (already led)
- **Player kills faction leader**: **FACTION_LEADER_SLAIN** + **FACTION_BROKEN** events emitted; faction marked broken
- **All faction leaders slain**: **DUNGEON_OGRE_EMERGED** event; the Ogre becomes the final boss

### New Deepest Floor

When the player reaches a new deepest floor: **FACTION_POWER_CHANGED** events emitted with reason `'new_deepest_floor'`, allowing factions to gain power from player progression.

---

## Step 3: Wire Leader Templates

The leader template must be defined in `packages/content/src/enemies/`:

```typescript
export const goblinWarlord: EnemyTemplate = {
  templateId: 'goblin_warlord',
  name: 'Goblin Warlord',
  archetype: 'leader',
  tier: 4,  // Higher tier = stronger
  stats: {
    maxHealth: 80,
    attack: 12,
    defense: 5,
    accuracy: 80,
    evasion: 20,
    speed: 110,
  },
  // ... other properties ...
};
```

Leaders should have higher stats than regular members and represent the faction's peak power.

---

## Step 4: Validate Faction IDs

Add a contract test to verify your faction is registered correctly:

```typescript
// tests/contracts/factions.contract.test.ts
describe('Faction definitions', () => {
  it('my new faction exists in FACTION_DEFINITIONS', () => {
    const faction = FACTION_DEFINITIONS.get('my_faction');
    expect(faction).toBeDefined();
    expect(faction?.leaderTemplateId).toBeDefined();
    // Leader template must exist
    expect(ENEMY_TEMPLATES.get(faction!.leaderTemplateId)).toBeDefined();
  });
});
```

---

## Key Files Reference

| Purpose | File |
|---------|------|
| Definitions | `packages/content/src/factions/` |
| Leader templates | `packages/content/src/enemies/` |
| State tracking | `packages/game-contracts/src/types/game-state.ts` (FactionState) |
| Progression logic | `packages/game-core/src/systems/factions.ts` |
| Consequences | `packages/game-core/src/systems/world-consequences.ts` |
| UI display | `apps/web/src/components/FactionDetailModal.tsx` |

---

## Testing Checklist

Before shipping a new faction:

- [ ] `FACTION_DEFINITIONS` includes the faction
- [ ] Leader template exists and has valid stats
- [ ] Leader name/title pools are non-empty
- [ ] Leader template is stronger than regular members
- [ ] Contract test validates IDs exist
- [ ] Faction power is 0–100
- [ ] Disposition is -100 to +100
- [ ] `pnpm validate` passes
