# Bug: Ambient Behavior Engine Social State Analysis Broken

**Status:** Blocking | Test Coverage Impact  
**Severity:** High  
**Discovered:** 2026-04-25 via new test suite

## Problem

The `analyzeSocialState()` function in `ambient-behavior-engine.ts` is not correctly counting allies within the social radius. New test suite revealed:

1. **Same-type allies not counted**: Function returns 0 allies when there should be 2
   - Test: `analyzeSocialState > counts same-type allies within radius`
   - Expected: 2, Got: 0

2. **Other-type allies not counted**: Function returns 0 allies when there should be 1
   - Test: `analyzeSocialState > counts other-type allies within radius`
   - Expected: 1, Got: 0

3. **Nearest ally position not found**: Function returns null when should return position
   - Test: `analyzeSocialState > finds nearest ally position`
   - Expected: `{x: 6, y: 5}`, Got: `null`

## Impact

- `shouldTransition()` cannot trigger state changes on `'ally_nearby'` trigger
- `shouldTransition()` cannot trigger state changes on `'no_allies'` trigger
- Ambient behavior clustering (regrouping) is completely broken
- Enemies will not detect nearby allies and will not coordinate behavior

## Root Cause

The `analyzeSocialState()` function likely has issues with:
- Enemy position comparison/distance calculation to allies
- Social radius parameter not being passed or used correctly
- Ally iteration/filtering logic

## Solution Steps

1. Review `analyzeSocialState()` implementation in `ambient-behavior-engine.ts`
2. Verify it's iterating over all enemies in the run state correctly
3. Verify Chebyshev distance calculation against social radius parameter
4. Verify logic for counting same-type vs other-type allies
5. Fix nearest ally position tracking
6. Run test suite to verify: `pnpm vitest run packages/game-core/src/systems/ambient-behavior-engine.test.ts`

## Related Tests

- `packages/game-core/src/systems/ambient-behavior-engine.test.ts` (5 failing tests)
- All failures point to social state analysis issues

## Next Steps

- [ ] Investigate analyzeSocialState implementation
- [ ] Fix ally counting logic
- [ ] Verify nearest ally position logic
- [ ] Confirm all 5 tests pass
