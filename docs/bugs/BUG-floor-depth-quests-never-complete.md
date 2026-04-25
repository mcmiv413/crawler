# BUG: floor-depth quests never complete

**Status:** Fixed
**Severity:** High
**Files:** `packages/game-core/src/engine/game-engine.ts`, `packages/game-core/src/systems/npc.ts`, `packages/content/src/quests/gather-rare-materials.ts`, `packages/content/src/quests/rescue-expedition.ts`

## Description

Live quest templates with `targetFloorDepth` can be granted to the player, but the engine path responsible for floor-depth completion is a no-op. `completeFloorDepthQuests()` is still called on dungeon entry, floor descent, and floor ascent, yet it always returns the input state with no events.

## Root Cause

The engine still carries an outdated TODO claiming `targetFloorDepth` requires a contracts update, but the field already exists in content and quest instantiation. The missing piece is the actual completion logic and event emission inside `completeFloorDepthQuests()`.

## Impact

- Informant NPCs can assign floor-depth quests into `activeQuests`
- Reaching the required floor never marks those quests complete
- Rewards tied to those quests are effectively unattainable
