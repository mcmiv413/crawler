# Bug: Town Shop Items Always Empty

**Status:** Blocking | Test Coverage Impact  
**Severity:** Medium  
**Discovered:** 2026-04-25 via new test suite

## Problem

The `buildTownView()` function in `town-view-builder.ts` is returning empty shop item arrays even when items should be available.

Test failures:
1. Test: `buildTownView > shop > applies shopkeeper discount`
   - Expected: shop item with discount applied
   - Got: empty array (item undefined)

2. Test: `buildTownView > shop > shows all shop items when prosperity is high`
   - Expected: 2 items
   - Got: 0 items

## Impact

- Player cannot see any shop items
- Shop always appears empty
- Cannot buy or sell equipment through UI

## Root Cause

The shop item filtering chain in `buildTownView()` has multiple filters that may be too strict:

```typescript
.filter(si => si.stock > 0)                    // Filter 1: in stock
.filter((_, idx) => prosperity >= 25 || idx < 3)  // Filter 2: prosperity check
.filter(si => {                                 // Filter 3: rarity check
  const template = ITEM_BY_ID.get(si.itemId);
  if (!template) return false;                  // ← BLOCKS ITEMS NOT IN ITEM_BY_ID
  return isRarityBuyable(template.rarity, state.world.highestRarityFound ?? 'common');
})
```

**Issue:** The `ITEM_BY_ID` lookup is failing. Items are not in the registry, causing all items to be filtered out by the rarity check.

Possible causes:
1. `ITEM_BY_ID` is empty or not initialized
2. Shop items use different IDs than what's in `ITEM_BY_ID`
3. Items were added to shop but not registered in `ITEM_BY_ID`

## Solution

1. Verify `ITEM_BY_ID` is properly exported and populated
2. Check shop item IDs match keys in `ITEM_BY_ID`
3. Consider fallback logic for items not in registry (log warning but allow display)
4. Add test data with proper ITEM_BY_ID setup

## Related Tests

- `packages/presenter/src/builders/town-view-builder.test.ts` lines 243-295

## Next Steps

- [ ] Verify ITEM_BY_ID is initialized properly
- [ ] Check shop item IDs in test data
- [ ] Add defensive logic for missing templates
- [ ] Run tests to verify: `pnpm vitest run packages/presenter/src/builders/town-view-builder.test.ts`
