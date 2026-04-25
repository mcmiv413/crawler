# Bug: PlayerHud Floor Property Not Reading from Run State

**Status:** Blocking | Test Coverage Impact  
**Severity:** Medium  
**Discovered:** 2026-04-25 via new test suite

## Problem

The `buildPlayerHud()` function in `player-hud-builder.ts` is not correctly reading the current floor depth from the run state. 

Test failure:
- Test: `buildPlayerHud > dungeon context > displays current floor depth`
- Expected floor: 5
- Got floor: 0 (or undefined)

## Impact

- Player HUD doesn't display correct floor depth
- UI will show wrong floor information in dungeon
- Gameplay feedback loop broken

## Root Cause

In `player-hud-builder.ts`, line with:
```typescript
floor: p.floor,
```

The function is reading `player.floor` instead of `run.floor.depth`. The player object has a `floor` property (likely used for tracking last retreat floor), but the actual current floor is in `state.run.floor.depth`.

## Solution

Change the player HUD builder to read:
```typescript
floor: state.run?.floor.depth ?? p.floor,
```

Or if `p.floor` is meant to be dungeon floor, verify it's being updated when the run progresses.

## Related Tests

- `packages/presenter/src/builders/player-hud-builder.test.ts` line 344

## Next Steps

- [ ] Verify intended source of floor depth (player.floor vs run.floor.depth)
- [ ] Fix buildPlayerHud to read correct property
- [ ] Run test to verify: `pnpm vitest run packages/presenter/src/builders/player-hud-builder.test.ts`
