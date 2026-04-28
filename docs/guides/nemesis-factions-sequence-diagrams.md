# Nemesis and Faction Sequence Diagrams

These Mermaid sequence diagrams reflect the current code paths for the nemesis and faction systems. They are intentionally implementation-focused: engine, server, presenter, UI, rewards, and the main "works today" limitations are all included.

---

## Nemesis System

### 1. Promotion on player death and naming

```mermaid
sequenceDiagram
    autonumber
    actor Player
    participant Web as Web App / Store
    participant API as Server API
    participant Cmd as processGameCommand
    participant Engine as GameEngine.submitCommand
    participant Death as death.ts
    participant Nem as nemesis.ts
    participant AI as CompositeAiService
    participant Present as Presenter
    participant UI as App + NemesisRisenScreen

    Player->>Web: Send command
    Web->>API: POST /api/games/:id/commands
    API->>Cmd: processGameCommand()
    Cmd->>Engine: submitCommand(state, command)

    Note over Engine,Death: During enemy turns or status resolution, player HP reaches 0
    Engine->>Death: handlePlayerDeath(...)

    Death->>Death: Emit PLAYER_DIED
    Death->>Death: Emit RUN_ENDED(reason=death) + PHASE_CHANGED(to=town)
    opt Equipped items exist
        Death->>Death: Emit EQUIPMENT_DROPPED
    end

    alt Killer enemy exists and shouldPromoteToNemesis() passes
        Death->>Nem: promoteToNemesis(state, killer, floor, rng)
        Nem->>Nem: Rank = prior records of same template + 1 (cap 3)
        Nem->>Nem: Boost stats by rank multiplier + floor-based min HP
        Nem->>Nem: If prior same-template nemesis was slain by same weapon type, add +3 DEF
        Nem->>Nem: Create NemesisRecord{traits:[], weaknesses:[], encounterCount:0, killCount:1, isActive:true}
        Nem-->>Death: state + NEMESIS_PROMOTED(fallback name/title)
    else Trap/status death, permadeath, low floor, cap reached, or RNG fail
        Death-->>Engine: No nemesis promotion
    end

    Engine->>Engine: applyRunConsequences() because runEnded=true
    Engine-->>Cmd: result.state + events

    opt NEMESIS_PROMOTED exists
        Cmd->>AI: generateNemesisName({sourceTemplateId, tier, floor, biome})
        alt LM Studio returns valid JSON
            AI-->>Cmd: {name, title}
        else Parse/LM failure
            AI-->>Cmd: fallback random {name, title}
        end
        Cmd->>Cmd: Update state.world.nemeses[name,title]
        Note over Cmd,Present: The NEMESIS_PROMOTED event itself is not rewritten.<br/>Combat log text can still use the pre-AI fallback name.
    end

    Cmd->>Cmd: appendEventHistory(events)
    Cmd->>Present: buildGameView() + formatEvents()
    Present-->>Web: GameView{town.nemeses, deathContext, combatLog}
    Web->>UI: Show NemesisRisenScreen when town.runSummaryStats.nemesisPromoted=true

    Note over UI: App first tries to parse the risen name from combat log;<br/>if it no longer matches renamed state, it falls back to the last active nemesis.
```

### 2. Return spawning, encounter, and player-visible presence

```mermaid
sequenceDiagram
    autonumber
    actor Player
    participant Engine as GameEngine enter/descend/ascend
    participant Mods as buildWorldModifiers
    participant Pop as populateFloor / pickEnemy
    participant Turn as processEnemyTurns
    participant Present as Presenter
    participant UI as Dungeon UI / Town UI

    Player->>Engine: Enter dungeon or change floor
    Engine->>Mods: buildWorldModifiers(world, depth)

    Mods->>Mods: extraEnemies += active nemeses eligible for this depth
    Mods->>Mods: preferredTemplates = strong faction templates + active nemesis source templates
    Mods->>Mods: nemesesToSpawn = active nemeses where depth >= floorOfAscension

    Engine->>Pop: populateFloor(floor, biome, rng, worldMods)
    Pop->>Pop: Spawn regular enemies with weighted preferred templates

    alt Eligible active nemesis exists
        Pop->>Pop: On floorOfAscension => guaranteed spawn
        Pop->>Pop: On deeper floors => 70% chance
        Pop->>Pop: Replace same-template enemy if possible, else use open tile
        Pop->>Pop: Override enemy with NemesisRecord name/stats and attach nemesisId
        Note over Pop: Only one nemesis is spawned per floor.
    end

    Engine->>Present: buildMapView() + buildTownView()
    Present-->>UI: Map entity {isNemesis, nemesisName}
    Present-->>UI: Town "Known Threats" list shows active nemeses
    Note over UI: DungeonView prefixes nemesis ASCII with '*'<br/>and AttackDropdown shows a star badge + nemesis name.

    loop Enemy turns
        Turn->>Turn: Check alert radius (<= 5 tiles)
        alt Nemesis becomes alerted
            Turn->>Turn: Emit ENEMY_ALERTED + NEMESIS_ENCOUNTERED
            Turn->>Turn: Increment NemesisRecord.encounterCount
            Turn->>Present: format NEMESIS_ENCOUNTERED
            Present-->>UI: Combat log = "<nemesis> has found you!"
        end
    end
```

### 3. Defeat, rewards, loot generation, and downstream town effects

```mermaid
sequenceDiagram
    autonumber
    actor Player
    participant Combat as handleAttack / executeAbility
    participant Kill as processEnemyKill
    participant Nem as slayNemesis
    participant Cmd as processGameCommand
    participant AI as CompositeAiService
    participant Loot as rollNemesisLoot
    participant Present as Presenter
    participant Store as Web Store
    participant UI as NemesisSlainScreen
    participant Town as applyRunConsequences / evaluateEventChains

    Player->>Combat: Kill enemy
    Combat->>Kill: processEnemyKill(newState, enemy, ...)
    Kill->>Kill: Remove enemy, grant XP, life-steal, normal gold/item loot

    alt enemy.nemesisId exists or template matches an active nemesis
        Kill->>Nem: slayNemesis(state, nemesisId, killingWeaponType)
        Nem->>Nem: Mark isActive=false
        Nem->>Nem: Persist killedByWeaponType
        Nem->>Nem: Deterministically unlock one blueprint + implied lower tiers
        Nem-->>Kill: Emit NEMESIS_SLAIN{blueprintUnlocked, lootItemName:null}
    end

    Kill-->>Cmd: state + events
    Cmd->>AI: generateNemesisLoot({name,title,tier,floor,traits,weaponType,rank})
    Note over AI: traits are currently stored but created as [] in promotion code.

    alt AI returns usable data
        AI-->>Cmd: {loot name, description}
        Cmd->>Loot: rollNemesisLoot(aiData, rank, tier, floor, killedByWeaponType)
        Loot->>Loot: Rarity by tier/rank
        Loot->>Loot: Weapon if killedByWeaponType exists, else chest armor
        Cmd->>Cmd: addItemToInventory(lootTemplate)
        Cmd->>Cmd: Patch NEMESIS_SLAIN.lootItemName
    else Unexpected generation error
        Cmd->>Cmd: Keep base slain event and log warning
    end

    Cmd->>Cmd: appendEventHistory(events)
    Cmd->>Present: buildGameView() + buildTownView() + formatEvents()
    Present-->>Store: recentlyDefeatedNemesis + slainNemeses + combat log
    Store->>Store: Detect newly appeared recentlyDefeatedNemesis
    Store-->>UI: 2s slain transition, then NemesisSlainScreen

    opt A later run ends
        Town->>Town: applyRunConsequences()
        Town->>Town: evaluateEventChains()
        alt recent NEMESIS_SLAIN exists and activeNemeses == 0
            Town->>Town: prosperity += NEMESIS_SLAIN_WORLD_EFFECTS.prosperityGain
            Town->>Town: corruption -= NEMESIS_SLAIN_WORLD_EFFECTS.corruptionLoss
        else Any active nemesis remains
            Town->>Town: No "all nemeses slain" bonus yet
        end
    end

    Note over Town: The town-wide slain-nemesis reward is checked at run end,<br/>not directly inside slayNemesis().
```

### Nemesis notes for current behavior

- Nemesis creation only happens on enemy-caused player death. Trap, status, and permadeath paths do not create a nemesis.
- Nemesis names are generated twice conceptually: a fallback name/title inside `promoteToNemesis()`, then an optional server-side AI rename. The event/combat log keeps the original promoted-event name.
- `traits` and `weaknesses` exist in types and UI, but promotion currently initializes both as empty arrays.
- `killCount` is initialized and displayed, but the current code does not increment it after creation.

---

## Faction System

### 1. Initialization and data model

```mermaid
sequenceDiagram
    autonumber
    participant Content as content/factions/*
    participant World as createInitialWorldState
    participant EnemyDefs as EnemyTemplate definitions
    participant State as GameState.world
    participant Present as Presenter
    participant UI as TownPhase + CharacterScreen

    Content->>World: INITIAL_FACTIONS from FACTION_DEFINITIONS
    Note over Content: Current built-ins:<br/>Beast Swarm, Goblin Warband,<br/>Shadow Cult, Undead Legion

    EnemyDefs->>State: EnemyTemplate.factions[] links enemies to factionId(s)
    World->>State: world.factions = [...INITIAL_FACTIONS]
    State->>Present: buildTownView() / buildPlayerHud()
    Present-->>UI: Town faction rows
    Present-->>UI: CharacterScreen "Factions" modal data

    Note over State,Present: FactionState today = {id, name, power, disposition}.<br/>There are no faction-specific DomainEvents.
```

### 2. Power and disposition mutation loop

```mermaid
sequenceDiagram
    autonumber
    actor Player
    participant Combat as processEnemyKill
    participant FSys as factions.ts
    participant Content as getPrimaryFactionId
    participant Engine as GameEngine
    participant World as applyRunConsequences
    participant Present as Presenter
    participant UI as Town + Faction modal

    Player->>Combat: Kill an enemy
    Combat->>FSys: updateFactionOnKill(state, enemy.templateId)
    FSys->>Content: getPrimaryFactionId(templateId)

    alt Enemy template has a primary faction
        Content-->>FSys: factionId
        FSys->>FSys: power = max(0, power - 3)
        Note over FSys: State mutates silently; no event is emitted.
    else No faction on template
        FSys-->>Combat: State unchanged
    end

    opt Run later ends
        Engine->>World: applyRunConsequences(state, runMetrics)
        World->>FSys: tickFactionPowerForNemeses(state)
        alt Active nemesis exists
            FSys->>FSys: For each unique active nemesis source faction,<br/>power = min(100, power + 5)
        end

        World->>World: evaluateEventChains()
        alt faction.power == 0 and disposition < -10
            World->>World: disposition = min(-10, disposition + 20)
            Note over World: "broken/scattered" factions soften toward the player.
        end
    end

    World->>Present: buildTownView() + buildPlayerHud()
    Present-->>UI: Updated power/disposition/standing
```

### 3. Spawn bias, rumors, and current presentation rules

```mermaid
sequenceDiagram
    autonumber
    actor Player
    participant Engine as GameEngine enter/descend/ascend
    participant Mods as buildWorldModifiers
    participant FSys as Faction helpers
    participant Pop as pickEnemy / populateFloor
    participant Cmd as processGameCommand
    participant AI as CompositeAiService / FallbackAiService
    participant Present as Presenter
    participant UI as TownPhase + FactionDetailModal

    Player->>Engine: Start run or change floor
    Engine->>Mods: buildWorldModifiers(world, depth)
    Mods->>FSys: getTemplateIdsForFaction(faction.id) for factions with power > 60
    FSys-->>Mods: template IDs
    Mods->>Mods: preferredTemplates = strong faction templates + active nemesis templates

    Engine->>Pop: populateFloor(..., worldMods)
    Pop->>Pop: pickEnemy() weights:
    Note over Pop: preferred template x3<br/>preferred archetype x2<br/>preferred damage type x2
    Pop->>Pop: Preferred faction templates can be added even outside the biome pool
    Pop-->>Engine: Faction-biased enemy roster

    opt Run ends
        Cmd->>AI: attachRumors()
        alt LM Studio path
            AI->>AI: buildRumorPrompt(townState, deepestFloor, totalRuns)
            Note over AI: Prompt has no faction list and no faction power.
        else Fallback path
            AI->>AI: Randomly mix FACTION_RUMORS when totalRuns > 0
            Note over AI: This does not check which factions are actually strong.
        end
    end

    Engine->>Present: buildTownView()
    Present->>Present: trend = rising if faction has active nemesis
    Present->>Present: trend = falling if only slain nemeses exist
    Present->>Present: standing = disposition + 100
    Present->>Present: alignment label = strong/weak/neutral from power
    Present-->>UI: Town shows power/disposition/trend
    Present-->>UI: FactionDetailModal shows standing bar + enemies currently in dungeon
```

### Faction notes for current behavior

- Factions are currently a relatively thin system: mostly `power`, `disposition`, spawn bias, rumors, and UI readouts.
- Faction mutations are silent state changes today. There are no faction-specific domain events.
- Kill-based faction updates use the enemy template's primary faction only.
- Faction trend in town is nemesis-driven, not power-delta-driven.
- The CharacterScreen faction modal labels "Disposition" using a power-derived strong/weak/neutral string, while the standing bar uses `disposition + 100`.
- Fallback faction rumors are only loosely connected to actual world state; they do not check which factions are currently strongest.
