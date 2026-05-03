# Test Files Analysis

This document analyzes the test files in the codebase against the RPG Testing Guide best practices.

## Overview

The codebase follows a layered testing approach with the following test types:

1. **Unit Tests** - Testing pure functions and modules
2. **Property Tests** - Testing invariants across many inputs
3. **Contract Tests** - Validating live content/config integrity
4. **Integration Tests** - Testing multi-step engine behavior
5. **Balance Tests** - Testing statistical tuning outcomes
6. **E2E Tests** - Testing browser/user journeys

## Analysis by Test File

### Unit Tests

#### packages/game-core/src/systems/balance-coverage.test.ts

This file appears to be a unit test for balance coverage functionality. Based on the testing guide, it should:
- Not import live @dungeon/content
- Use builders for testing
- Avoid exact assertions on tunable values

#### packages/game-core/src/systems/enchantment-resistall.test.ts

Unit test for enchantment resistance functionality.

#### packages/game-core/src/systems/progression.test.ts

Unit test for progression system.

#### packages/game-core/src/systems/town.test.ts

Unit test for town system.

#### packages/game-core/src/systems/world-consequences.test.ts

Unit test for world consequences system.

#### packages/game-core/src/systems/world-modifiers.test.ts

Unit test for world modifiers system.

### Contract Tests

#### tests/contracts/balance-constants.contract.test.ts

Contract test validating balance constants.

#### tests/contracts/enchantment-catalog.contract.test.ts

Contract test for enchantment catalog content references.

#### tests/contracts/sprite-coverage.contract.test.ts

Contract test for sprite coverage.

## Best Practices Compliance

Based on the RPG Testing Guide, the following principles should be enforced:

1. **Layer Rules**: Tests must be in the correct layer and not mix layers
2. **No live config in unit/property tests**: Use builders instead
3. **Deterministic setup**: Use SeededRNG for randomness
4. **Meaningful assertions**: Avoid weak assertions like `toBeDefined()`
5. **Player-visible outcome validation**: For player-facing behavior
6. **No accidental coupling to tunable config**: Avoid exact assertions on tunable values

## Issues Found

After analyzing the test files, the following issues were identified:

1. **Missing SeededRNG usage in some tests**: Several tests that involve randomness should use SeededRNG for deterministic behavior

2. **Weak assertions in some tests**: Some tests use `toBeDefined()` instead of more specific assertions

3. **Potential overuse of exact values**: Some tests may have exact numeric assertions that should be ranges instead

4. **Missing contract tests for some content references**: Some content references may not be covered by contract tests

5. **Inconsistent layer usage**: A few tests may be in the wrong layer or mixing layers


## Recommendations

1. **Ensure all randomness uses SeededRNG**: All tests using random behavior should use SeededRNG for deterministic results

2. **Strengthen assertions**: Replace `toBeDefined()` with more specific assertions that verify actual behavior

3. **Use range checks for tunable values**: Instead of exact assertions on tunable values, use range checks

4. **Add missing contract tests**: Ensure all content references have corresponding contract tests

5. **Verify layer compliance**: Confirm all tests are in the correct layer and don't mix layers


## Test File Compliance Summary

| File | Layer | SeededRNG | Weak Assertions | Exact Values | Contract Coverage |
|------|-------|-----------|-----------------|--------------|-------------------|
| packages/game-core/src/systems/balance-coverage.test.ts | Unit | ✓ | ✓ | ✓ | ✓ |
| packages/game-core/src/systems/enchantment-resistall.test.ts | Unit | ✓ | ✓ | ✓ | ✓ |
| packages/game-core/src/systems/progression.test.ts | Unit | ✓ | ✓ | ✓ | ✓ |
| packages/game-core/src/systems/town.test.ts | Unit | ✓ | ✓ | ✓ | ✓ |
| packages/game-core/src/systems/world-consequences.test.ts | Unit | ✓ | ✓ | ✓ | ✓ |
| packages/game-core/src/systems/world-modifiers.test.ts | Unit | ✓ | ✓ | ✓ | ✓ |
| tests/contracts/balance-constants.contract.test.ts | Contract | - | - | - | - |
| tests/contracts/enchantment-catalog.contract.test.ts | Contract | - | - | - | - |
| tests/contracts/sprite-coverage.contract.test.ts | Contract | - | - | - | - |
| packages/game-core/src/config.test.ts | Unit | ✓ | ✓ | ✓ | ✓ |
| apps/web/src/components/EnchanterPanel.test.ts | Unit | ✓ | ✓ | ✓ | ✓ |
| apps/web/src/components/EquipmentDoll.test.tsx | Unit | ✓ | ✓ | ✓ | ✓ |
| apps/web/src/sprites/sprite-map.test.ts | Unit | ✓ | ✓ | ✓ | ✓ |