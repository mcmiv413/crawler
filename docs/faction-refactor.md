Based on the current RPG notes, this PRD replaces the nemesis-driven progression with faction leader progression while keeping v1 intentionally narrow: faction member strength, spawn frequency, town impact, and visible faction progress. 

````md
# PRD: Death-Driven Faction Leader Progression and Faction Power V1

## 1. Overview

Replace the current nemesis progression model with a tighter faction-driven progression system.

The game is roguelike and death-driven. Player death is not only failure; it is a world-state progression mechanism. When the player is killed by a faction member, that faction gains power. If the faction does not already have an active leader and has not been broken, a new faction leader emerges.

The player’s long-term objective is to:

1. Die to faction enemies to draw out faction leaders.
2. Hunt and kill each faction leader.
3. Break every major faction.
4. Trigger the Dungeon Ogre’s emergence.
5. Kill the Dungeon Ogre to win the game.

V1 intentionally limits faction power impact to:

1. Faction member strength.
2. Faction spawn frequency.
3. Town impact.
4. Player-visible faction progress.

V1 does not include faction-specific AI behavior, reinforcements, morale, territory control, room ownership, faction hazards, or advanced dungeon-generation changes.

---

## 2. Goals

### 2.1 Primary Goals

- Replace nemesis progression with faction leader progression.
- Make player death a clear driver of faction escalation.
- Make faction power matter through simple, visible systems.
- Make faction progress visible on the character panel.
- Add deterministic faction events instead of silent faction state mutation.
- Gate the Dungeon Ogre behind faction leader defeat progression.
- Keep v1 small enough to implement, test, and tune safely.

### 2.2 Player Experience Goals

The player should understand:

- Which factions exist.
- Which factions have leaders.
- Which leaders have been slain.
- Which factions are broken.
- How faction power affects enemy strength and spawn frequency.
- How faction power affects the town.
- What remains before the Dungeon Ogre emerges.

### 2.3 Engineering Goals

- Centralize all faction tuning values in config.
- Avoid hardcoded faction power deltas.
- Avoid spreading faction progression rules across unrelated combat, death, and presentation code.
- Emit faction-specific domain events for important state changes.
- Keep presenter logic responsible for display labels and explanatory text.
- Keep raw game state simple and durable.

---

## 3. Non-Goals

V1 must not include:

- Faction-specific enemy AI behavior.
- Reinforcement calls.
- Morale/flee behavior.
- Patrol coordination.
- Faction-controlled rooms.
- Leader strongholds.
- Faction-specific hazards.
- Cross-biome faction invasions.
- Advanced town simulation.
- Ogre fight modifiers based on faction state.
- Multiple active leaders per faction.
- Multiple leader tiers.
- Elite leader hierarchy.
- Delayed leader emergence.
- Leader emergence based on power thresholds.
- Rebuilding the full dungeon generation system.

These ideas may be considered later, but they are explicitly out of scope for v1.

---

## 4. Current Problem

The current nemesis system has several issues:

- Nemesis creation is tied to enemy-caused player death.
- Nemesis identity and faction power overlap conceptually.
- Nemesis names can diverge between promoted-event text and final AI-renamed state.
- Nemesis traits and weaknesses exist in the type system/UI but are initialized as empty.
- Nemesis kill count is initialized but not meaningfully evolved.
- Faction mutations are currently silent state changes.
- Faction trend is driven by nemesis state instead of actual faction power changes.
- Faction rumors are weakly connected to real faction state.
- Factions already exist but are not the primary progression spine.

The new design removes nemesis as a separate progression concept and makes faction leaders the primary death-driven world progression mechanic.

---

## 5. Core Design

### 5.1 Faction Lifecycle

Each major faction has one of three statuses:

```ts
type FactionStatus = "leaderless" | "led" | "broken";
````

### 5.2 Status Meaning

| Status       | Meaning                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------ |
| `leaderless` | Faction exists but has no active leader. A player death to this faction can create one.          |
| `led`        | Faction has an active leader. Killing the leader breaks the faction.                             |
| `broken`     | Faction leader has been slain. The faction cannot produce another leader during this game cycle. |

### 5.3 Lifecycle Flow

```txt
leaderless
  ↓ player is killed by faction member
led
  ↓ player kills faction leader
broken
  ↓ all major factions are broken
Dungeon Ogre emerges
  ↓ player kills Dungeon Ogre
game won
```

---

## 6. Faction Progression Rules

### 6.1 Killing Regular Faction Members

When the player kills a regular faction member:

* Determine the enemy’s primary faction.
* Reduce that faction’s power by the configured regular member kill power loss.
* Increment `membersKilledByPlayer`.
* Emit a faction power changed event.

Default v1 value:

```ts
memberKillPowerLoss: 1
```

Do not hardcode `-1` in the faction logic. Use central config.

### 6.2 Player Death to a Leaderless Faction

When the player is killed by a faction member and that faction is `leaderless`:

* Increase faction power by configured player death power gain.
* Create a new faction leader.
* Set faction status to `led`.
* Set `activeLeaderId`.
* Increment `playerDeathsCaused`.
* Emit:

  * `FACTION_POWER_CHANGED`
  * `FACTION_LEADER_EMERGED`

The faction leader is not the same enemy that killed the player.

The killer is the cause of faction escalation, not the promoted unit.

Example:

```txt
A goblin scout killed the player.
The Goblin Warband rallies.
Brakka Knife-King emerges as faction leader.
```

### 6.3 Player Death to an Already-Led Faction

When the player is killed by a faction member and that faction is already `led`:

* Increase faction power by configured player death-with-leader power gain.
* Do not create a second leader.
* Keep existing `activeLeaderId`.
* Increment `playerDeathsCaused`.
* Emit `FACTION_POWER_CHANGED`.

Default v1 value:

```ts
playerDeathWithLeaderPowerGain: 8
```

### 6.4 Player Death to a Broken Faction

When the player is killed by a faction member and that faction is `broken`:

* Do not create a new leader.
* Do not change status.
* Optional v1 behavior:

  * Either apply no power gain, or apply a very small remnant power gain.
* Recommended v1 behavior:

  * No leader respawn.
  * No meaningful power gain.
  * Broken remains broken.

### 6.5 Player Death to Non-Faction Sources

If the player dies to a trap, neutral enemy, environmental effect, or untracked source:

* No faction leader emerges.
* No faction power changes unless a faction source can be reliably attributed.

If poison/status damage caused by a faction member can be tracked, it may count as that faction killing the player.

---

## 7. Faction Leader Rules

### 7.1 Leader Creation

Faction leaders are generated from faction-specific leader pools.

A leader should include:

```ts
type FactionLeaderState = {
  id: string;
  factionId: FactionId;

  name: string;
  title: string;
  templateId: EnemyTemplateId;

  isActive: boolean;
  isSlain: boolean;

  emergedOnRun: number;
  emergedOnDepth: number;
};
```

V1 does not require:

* leader tiers
* leader traits
* leader weaknesses
* leader evolution
* elite leader variants
* AI-generated personality depth

Those can come later.

### 7.2 Killing a Faction Leader

When the player kills a faction leader:

* Mark leader inactive.
* Mark leader slain.
* Clear `activeLeaderId`.
* Set faction status to `broken`.
* Set `leaderSlain` to true.
* Reduce faction power by configured leader kill power loss.
* Increment `leadersKilledByPlayer`.
* Emit:

  * `FACTION_LEADER_SLAIN`
  * `FACTION_POWER_CHANGED`
  * `FACTION_BROKEN`

Default v1 value:

```ts
leaderKillPowerLoss: 35
```

### 7.3 Broken Factions

Once a faction is broken:

* It cannot create another leader during the current game cycle.
* It counts toward Dungeon Ogre emergence.
* Its spawn frequency uses the `broken` band.
* Its member strength uses the `broken` band.
* Its town impact uses the `broken` band.

---

## 8. Dungeon Ogre Win Condition

### 8.1 Ogre Emergence

The Dungeon Ogre emerges when every major faction has been broken.

```ts
const shouldEmergeDungeonOgre = factions.every(
  faction => faction.status === "broken" && faction.leaderSlain,
);
```

When the condition becomes true:

* Set Dungeon Ogre status to `emerged`.
* Emit `DUNGEON_OGRE_EMERGED`.
* Update character panel objective text.
* Update town/run summary text.

### 8.2 Ogre State

```ts
type DungeonOgreState = {
  id: "dungeon_ogre";
  status: "sealed" | "emerged" | "slain";
  emergedAfterRun?: number;
};
```

### 8.3 Winning the Game

When the player kills the Dungeon Ogre:

* Set Dungeon Ogre status to `slain`.
* Emit `DUNGEON_OGRE_SLAIN`.
* Emit `GAME_WON`.
* Transition to victory state/screen.

---

## 9. Faction State Model

Update faction state to include progression fields.

```ts
type FactionState = {
  id: FactionId;
  name: string;

  power: number;
  status: FactionStatus;

  activeLeaderId?: string;
  leaderSlain: boolean;

  membersKilledByPlayer: number;
  leadersKilledByPlayer: number;
  playerDeathsCaused: number;

  lastPowerDelta?: number;
  lastPowerChangeReason?: FactionPowerChangeReason;
};
```

Power is clamped between configured min/max.

```ts
type FactionPowerChangeReason =
  | "member_killed"
  | "player_death"
  | "player_death_with_leader"
  | "leader_killed"
  | "town_tick";
```

---

## 10. Central Config

All faction tuning must be centralized.

Recommended initial config:

```ts
export const FACTION_CONFIG = {
  power: {
    min: 0,
    max: 100,

    memberKillPowerLoss: 1,
    playerDeathPowerGain: 20,
    playerDeathWithLeaderPowerGain: 8,
    leaderKillPowerLoss: 35,

    bands: {
      weakMax: 24,
      stableMax: 59,
      strongMax: 79,
      dominantMax: 100,
    },
  },

  memberStrength: {
    multiplierByBand: {
      broken: 0.8,
      weak: 0.9,
      stable: 1.0,
      strong: 1.1,
      dominant: 1.2,
    },
  },

  spawning: {
    weightMultiplierByBand: {
      broken: 0.35,
      weak: 0.75,
      stable: 1.0,
      strong: 1.5,
      dominant: 2.0,
    },
  },

  town: {
    impactByBand: {
      broken: {
        prosperityDelta: 2,
        corruptionDelta: -2,
      },
      weak: {
        prosperityDelta: 1,
        corruptionDelta: -1,
      },
      stable: {
        prosperityDelta: 0,
        corruptionDelta: 0,
      },
      strong: {
        prosperityDelta: -1,
        corruptionDelta: 1,
      },
      dominant: {
        prosperityDelta: -2,
        corruptionDelta: 2,
      },
    },

    activeLeaderImpactModifier: 1,

    maxProsperityGainPerRunFromFactions: 5,
    maxProsperityLossPerRunFromFactions: 5,
    maxCorruptionGainPerRunFromFactions: 5,
    maxCorruptionLossPerRunFromFactions: 5,
  },
} as const;
```

These values are initial tuning values only.

---

## 11. Derived Faction Power Bands

Faction power band should be derived, not stored.

```ts
type FactionPowerBand =
  | "broken"
  | "weak"
  | "stable"
  | "strong"
  | "dominant";
```

Recommended helper:

```ts
const getFactionPowerBand = (faction: FactionState): FactionPowerBand => {
  if (faction.status === "broken") {
    return "broken";
  }

  if (faction.power <= FACTION_CONFIG.power.bands.weakMax) {
    return "weak";
  }

  if (faction.power <= FACTION_CONFIG.power.bands.stableMax) {
    return "stable";
  }

  if (faction.power <= FACTION_CONFIG.power.bands.strongMax) {
    return "strong";
  }

  return "dominant";
};
```

Power band should be used by:

* spawn weighting
* member strength scaling
* town impact
* presenter labels
* character panel text

---

## 12. V1 Faction Power Impacts

Faction power affects only three gameplay areas in v1:

1. Faction member strength.
2. Faction spawn frequency.
3. Town impact.

---

## 13. Faction Member Strength

### 13.1 Rule

Faction power modifies the strength of regular faction members.

Recommended v1 affected stats:

* HP
* attack

Defense should not be modified in v1 unless combat math proves it is safe and readable.

### 13.2 Scaling

| Band     | Strength Multiplier |
| -------- | ------------------: |
| Broken   |                0.8x |
| Weak     |                0.9x |
| Stable   |                1.0x |
| Strong   |                1.1x |
| Dominant |                1.2x |

### 13.3 Application

Apply the multiplier when an enemy is created/spawned.

Example:

```ts
const applyFactionStrengthModifier = (
  enemy: Enemy,
  faction: FactionState,
): Enemy => {
  const band = getFactionPowerBand(faction);
  const multiplier = FACTION_CONFIG.memberStrength.multiplierByBand[band];

  return {
    ...enemy,
    maxHp: Math.max(1, Math.round(enemy.maxHp * multiplier)),
    hp: Math.max(1, Math.round(enemy.hp * multiplier)),
    attack: Math.max(1, Math.round(enemy.attack * multiplier)),
  };
};
```

### 13.4 Leader Exclusion

Faction leaders should not accidentally receive both:

* leader-specific scaling
* regular member faction scaling

V1 rule:

* Either leaders use their own leader stats and do not receive regular member scaling,
* or leader scaling is explicitly applied in one place.

Do not double-scale leaders.

---

## 14. Faction Spawn Frequency

### 14.1 Rule

Faction power modifies how often members of that faction appear.

### 14.2 Spawn Weight Multipliers

| Band     | Spawn Multiplier |
| -------- | ---------------: |
| Broken   |            0.35x |
| Weak     |            0.75x |
| Stable   |             1.0x |
| Strong   |             1.5x |
| Dominant |             2.0x |

### 14.3 Application

Apply the multiplier to enemy templates that belong to the faction.

Example:

```ts
const getFactionSpawnWeightMultiplier = (
  faction: FactionState,
): number => {
  const band = getFactionPowerBand(faction);
  return FACTION_CONFIG.spawning.weightMultiplierByBand[band];
};
```

Pseudo-flow:

```ts
const applyFactionSpawnWeights = (
  templates: WeightedEnemyTemplate[],
  factions: FactionState[],
): WeightedEnemyTemplate[] => {
  return templates.map(templateWeight => {
    const factionId = getPrimaryFactionId(templateWeight.template.id);

    if (!factionId) {
      return templateWeight;
    }

    const faction = factions.find(candidate => candidate.id === factionId);

    if (!faction) {
      return templateWeight;
    }

    const multiplier = getFactionSpawnWeightMultiplier(faction);

    return {
      ...templateWeight,
      weight: templateWeight.weight * multiplier,
    };
  });
};
```

### 14.4 V1 Constraint

Do not add cross-biome faction invasions in v1.

Faction power should modify eligible spawn weights only. It should not add faction enemies to floors or biomes where they would otherwise be completely ineligible.

---

## 15. Town Impact

### 15.1 Rule

Faction power affects town prosperity and corruption at run end.

High-power factions hurt the town.

Low-power or broken factions help the town recover.

### 15.2 Impact By Band

| Band     | Prosperity Delta | Corruption Delta |
| -------- | ---------------: | ---------------: |
| Broken   |               +2 |               -2 |
| Weak     |               +1 |               -1 |
| Stable   |                0 |                0 |
| Strong   |               -1 |               +1 |
| Dominant |               -2 |               +2 |

### 15.3 Active Leader Modifier

If a faction is `led`, apply an additional town penalty.

Default:

```ts
activeLeaderImpactModifier: 1
```

Example:

```ts
const getFactionTownImpact = (faction: FactionState): TownImpact => {
  const band = getFactionPowerBand(faction);
  const baseImpact = FACTION_CONFIG.town.impactByBand[band];

  if (faction.status !== "led") {
    return baseImpact;
  }

  return {
    prosperityDelta:
      baseImpact.prosperityDelta - FACTION_CONFIG.town.activeLeaderImpactModifier,
    corruptionDelta:
      baseImpact.corruptionDelta + FACTION_CONFIG.town.activeLeaderImpactModifier,
  };
};
```

### 15.4 Run-End Application

Town impact should be calculated and applied at run end.

Do not apply town impact every turn.

Run-end flow:

```txt
Run ends
  ↓
Evaluate faction power bands
  ↓
Calculate total prosperity/corruption delta
  ↓
Apply configured caps
  ↓
Update town state
  ↓
Emit TOWN_FACTION_IMPACT_APPLIED
```

### 15.5 Caps

Apply caps so town state does not spiral too quickly.

Example:

```ts
const clampTownDelta = (
  delta: TownImpact,
): TownImpact => {
  return {
    prosperityDelta: clamp(
      delta.prosperityDelta,
      -FACTION_CONFIG.town.maxProsperityLossPerRunFromFactions,
      FACTION_CONFIG.town.maxProsperityGainPerRunFromFactions,
    ),
    corruptionDelta: clamp(
      delta.corruptionDelta,
      -FACTION_CONFIG.town.maxCorruptionLossPerRunFromFactions,
      FACTION_CONFIG.town.maxCorruptionGainPerRunFromFactions,
    ),
  };
};
```

---

## 16. Character Panel Faction Progress

Faction progress must be visible on the character panel.

### 16.1 Character Panel Requirements

The character panel must show:

* each faction name
* faction status
* faction power
* faction power band
* active leader name/title, if any
* whether the faction is broken
* member kills
* player deaths caused by that faction
* world effect summary
* town effect summary
* progress text
* Dungeon Ogre emergence progress

### 16.2 Character Progress View Model

Presenter should expose a view model similar to:

```ts
type CharacterFactionProgressView = {
  factionId: string;
  name: string;

  status: "leaderless" | "led" | "broken";

  power: number;
  powerBand: "broken" | "weak" | "stable" | "strong" | "dominant";
  strengthLabel: string;

  leaderName?: string;
  leaderTitle?: string;

  membersSlain: number;
  deathsClaimed: number;

  countsTowardOgre: boolean;

  worldEffectText: string;
  townEffectText: string;
  progressText: string;
};
```

Ogre progress view:

```ts
type CharacterOgreProgressView = {
  status: "sealed" | "emerged" | "slain";
  brokenFactionCount: number;
  requiredFactionCount: number;
  remainingFactionNames: string[];
  progressText: string;
};
```

Character panel aggregate:

```ts
type CharacterProgressView = {
  factions: CharacterFactionProgressView[];
  ogre: CharacterOgreProgressView;
};
```

### 16.3 Example Display Text

Leaderless faction:

```txt
Beast Swarm
Status: Leaderless
Power: 38 / 100 — Stable
Leader: None
World Effect: Normal beast presence.
Town Effect: No major town impact.
Progress: This faction has not yet claimed your death.
```

Led faction:

```txt
Goblin Warband
Status: Led
Power: 72 / 100 — Strong
Leader: Brakka Knife-King
World Effect: Goblins are stronger and more common.
Town Effect: Hurting prosperity and increasing corruption.
Progress: Kill the leader to break this faction.
```

Broken faction:

```txt
Undead Legion
Status: Broken
Power: 18 / 100 — Broken
Leader Slain: Morvane Grave-Crowned
World Effect: Undead remnants are weaker and less common.
Town Effect: Helping the town recover.
Progress: Counts toward Dungeon Ogre emergence.
```

Ogre sealed:

```txt
Dungeon Ogre
Status: Sealed
Broken factions: 2 / 4
Remaining: Beast Swarm, Shadow Cult
Progress: Break every faction to draw out the Dungeon Ogre.
```

Ogre emerged:

```txt
Dungeon Ogre
Status: Emerged
Progress: Find and kill the Dungeon Ogre to win.
```

---

## 17. Town Presentation

Town view should summarize faction pressure.

V1 town presentation should include:

* strongest active faction
* active faction leaders
* broken factions
* net prosperity/corruption effect from factions at last run end

Example town summary:

```txt
Faction pressure is rising.
The Goblin Warband is strong under Brakka Knife-King.
The Undead Legion has been broken.
Town prosperity fell by 2.
Town corruption rose by 3.
```

Do not use random faction rumors that ignore actual faction state.

Faction-related town text must be generated from current faction state.

---

## 18. Domain Events

Faction changes should emit explicit domain events.

### 18.1 Required Events

```ts
type FactionEvent =
  | {
      type: "FACTION_POWER_CHANGED";
      factionId: FactionId;
      previousPower: number;
      newPower: number;
      delta: number;
      reason: FactionPowerChangeReason;
    }
  | {
      type: "FACTION_LEADER_EMERGED";
      factionId: FactionId;
      leaderId: string;
      leaderName: string;
      leaderTitle: string;
    }
  | {
      type: "FACTION_LEADER_SLAIN";
      factionId: FactionId;
      leaderId: string;
      leaderName: string;
      leaderTitle: string;
    }
  | {
      type: "FACTION_BROKEN";
      factionId: FactionId;
    }
  | {
      type: "DUNGEON_OGRE_EMERGED";
    }
  | {
      type: "DUNGEON_OGRE_SLAIN";
    }
  | {
      type: "GAME_WON";
    }
  | {
      type: "TOWN_FACTION_IMPACT_APPLIED";
      prosperityDelta: number;
      corruptionDelta: number;
    };
```

### 18.2 Event Usage

Events should support:

* combat log text
* run summary
* town summary
* character panel updates
* future AI-generated summaries
* tests

Faction mutation should not happen silently.

---

## 19. Suggested File/Module Boundaries

Exact paths may vary based on existing repo structure, but the implementation should preserve these responsibilities.

### 19.1 Config

```txt
content/config/factions.ts
```

or existing config location.

Contains:

* `FACTION_CONFIG`
* power deltas
* power band thresholds
* spawn multipliers
* strength multipliers
* town impact values

### 19.2 Faction Definitions

```txt
content/factions/*
```

Contains:

* faction IDs
* faction names
* enemy template associations
* leader name/title pools
* leader template IDs

### 19.3 Faction System Logic

```txt
core/world/factions.ts
```

Contains:

* power update helpers
* status transition helpers
* leader creation helpers
* power band helpers
* town impact helpers

### 19.4 Death Handling

```txt
core/death.ts
```

Should call faction progression logic when player death is attributed to a faction.

Should not directly implement faction state transitions inline.

### 19.5 Combat Kill Handling

```txt
core/combat/processEnemyKill.ts
```

Should call faction member kill or leader kill logic.

Should not hardcode faction power deltas.

### 19.6 Spawning

```txt
core/world/spawning/*
```

Should apply faction spawn weight multipliers.

Should not own faction progression rules.

### 19.7 Enemy Creation

```txt
core/world/enemies/*
```

Should apply faction member strength modifiers when enemies are created.

Should not double-scale faction leaders.

### 19.8 Presenter

```txt
presenter/*
```

Should build:

* character faction progress view
* ogre progress view
* town faction summary
* readable faction effect text

Presenter should derive display labels from state and config.

---

## 20. Testing Requirements

### 20.1 Unit Tests

Add tests for:

* power band derivation
* power clamping
* member kill power loss
* player death power gain
* leader creation on death to leaderless faction
* no second leader on death to led faction
* no leader respawn for broken faction
* leader kill breaks faction
* all factions broken triggers Dungeon Ogre emergence
* faction member strength multiplier selection
* faction spawn weight multiplier selection
* town impact calculation
* town impact caps

### 20.2 Integration Tests

Add tests for:

* player dies to faction member and faction leader emerges
* player kills leader and faction becomes broken
* broken faction affects spawn and strength multipliers
* faction power changes are visible in character progress view
* all faction leaders slain causes Dungeon Ogre emergence
* Dungeon Ogre slain causes game win

### 20.3 Presenter Tests

Presenter tests should verify derived display data, not raw config values.

Good:

```txt
Given a led strong faction,
the character panel shows an active leader and progress text telling the player to kill the leader.
```

Bad:

```txt
Expect Goblin Warband power label to equal exactly "72 / 100 — Strong" when using live config.
```

Mock config or construct explicit state where possible.

---

## 21. Acceptance Criteria

### 21.1 Faction Member Kill

Given the player kills a faction member,
when the enemy has a primary faction,
then that faction power decreases by `FACTION_CONFIG.power.memberKillPowerLoss`,
and `FACTION_POWER_CHANGED` is emitted.

### 21.2 Death to Leaderless Faction

Given the player dies to a faction member,
and that faction is `leaderless`,
then faction power increases by `playerDeathPowerGain`,
a faction leader is created,
the faction status becomes `led`,
and `FACTION_LEADER_EMERGED` is emitted.

### 21.3 Death to Led Faction

Given the player dies to a faction member,
and that faction is already `led`,
then faction power increases by `playerDeathWithLeaderPowerGain`,
no second leader is created,
and `FACTION_POWER_CHANGED` is emitted.

### 21.4 Death to Broken Faction

Given the player dies to a broken faction,
then no new leader is created,
and the faction remains broken.

### 21.5 Leader Kill

Given the player kills a faction leader,
then the leader is marked slain,
the faction status becomes `broken`,
faction power decreases by `leaderKillPowerLoss`,
and `FACTION_BROKEN` is emitted.

### 21.6 Ogre Emergence

Given all major factions are broken,
when faction progression is evaluated,
then the Dungeon Ogre status becomes `emerged`,
and `DUNGEON_OGRE_EMERGED` is emitted.

### 21.7 Ogre Victory

Given the Dungeon Ogre has emerged,
when the player kills the Dungeon Ogre,
then `DUNGEON_OGRE_SLAIN` and `GAME_WON` are emitted.

### 21.8 Spawn Frequency

Given a faction has a derived power band,
when faction enemy spawn weights are calculated,
then the faction’s templates are multiplied by the configured spawn multiplier for that band.

### 21.9 Member Strength

Given a faction enemy is spawned,
when the faction has a derived power band,
then the enemy HP and attack are multiplied by the configured member strength multiplier for that band.

### 21.10 Town Impact

Given a run ends,
when faction town impact is evaluated,
then prosperity and corruption are adjusted based on faction power bands,
and total deltas are capped by config.

### 21.11 Character Panel

Given the character panel is opened,
then the player can see:

* every major faction
* each faction’s status
* each faction’s power and power band
* active leader if present
* whether the faction counts toward Ogre emergence
* member kills
* deaths claimed
* world effect summary
* town effect summary
* remaining Ogre emergence progress

---

## 22. Migration Plan

### Phase 1: Add New Types and Config

* Add `FactionStatus`.
* Add faction progression fields to `FactionState`.
* Add `FactionLeaderState`.
* Add `DungeonOgreState`.
* Add `FACTION_CONFIG`.

### Phase 2: Add Faction Progression Logic

* Implement power update helpers.
* Implement power band derivation.
* Implement leader creation.
* Implement leader slain handling.
* Implement faction broken transition.
* Implement ogre emergence check.

### Phase 3: Wire Death Handling

* On player death, determine killer faction.
* If faction is leaderless, create leader.
* If faction is led, increase power only.
* If faction is broken, prevent leader respawn.

### Phase 4: Wire Kill Handling

* On regular faction member kill, reduce faction power.
* On faction leader kill, break faction.
* Emit required events.

### Phase 5: Apply Spawn Frequency Impact

* Modify spawn weight calculation to apply faction spawn multipliers.
* Keep v1 limited to eligible templates only.
* Do not add cross-biome faction spawns.

### Phase 6: Apply Member Strength Impact

* Apply faction strength multiplier during enemy creation.
* Ensure faction leaders are not double-scaled.

### Phase 7: Apply Town Impact

* At run end, calculate faction town impact.
* Apply caps.
* Emit town impact event.
* Display town impact summary.

### Phase 8: Character Panel Visibility

* Add character progress presenter view.
* Add faction progress section to character panel.
* Add Ogre emergence progress section.

### Phase 9: Remove or Deprecate Nemesis Progression

* Stop creating nemeses on player death.
* Replace nemesis UI language with faction leader language.
* Remove old nemesis state after faction leader flow is stable.
* Convert any useful nemesis loot/reward concepts into future faction leader reward concepts.

---

## 23. Open Questions

1. Should broken factions still gain small amounts of power from killing the player, or should broken mean no further faction escalation?
2. Should faction leaders have unique loot in v1, or should rewards wait until v2?
3. Should Dungeon Ogre emergence happen immediately after the final faction leader is slain, or only after the run ends?
4. Should the Ogre appear on a fixed depth, deepest reached depth, or special boss floor?
5. Should town impact be applied after every run end, including victory/death/retreat, or only after death?
6. Should leaderless factions with very high power have any special presentation, or is high power plus no leader enough?
7. Should the character panel use mechanical language, flavor language, or both?

---

## 24. Recommended Answers to Open Questions for V1

1. Broken factions should not create new leaders and should not meaningfully escalate.
2. Unique leader loot should wait until v2 unless existing loot hooks make it trivial.
3. Dungeon Ogre should emerge immediately after the final faction leader is slain.
4. Ogre should appear on a dedicated boss floor or clear final objective location.
5. Town impact should apply at run end, regardless of whether the run ended by death or retreat.
6. High-power leaderless factions do not need special mechanics in v1.
7. Character panel should use both mechanical and flavor language:

   * mechanical: `Power: 72 / 100 — Strong`
   * flavor: `Goblins are stronger and more common.`

---

## 25. Final V1 Summary

Faction power affects:

1. How often faction members spawn.
2. How strong faction members are.
3. How much pressure factions place on the town.

Faction status controls:

1. Whether a faction has no leader, an active leader, or is broken.
2. Whether leader emergence is possible.
3. Whether the faction counts toward Dungeon Ogre emergence.

Faction progression is visible in:

1. Character panel.
2. Town view.
3. Run-end summary.
4. Combat/event log.

Core win arc:

```txt
Die to factions → leaders rise.
Kill leaders → factions break.
Break all factions → Dungeon Ogre emerges.
Kill Dungeon Ogre → win.
```

```
```
