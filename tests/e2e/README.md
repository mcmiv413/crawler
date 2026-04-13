# E2E Test Suite - RPG Game Loop Tests

## Overview
This directory contains comprehensive end-to-end tests for the RPG dungeon crawler game using Playwright.

## Test Structure

### File: `game-loop.spec.ts` (750 lines)

#### Page Object Model: `GamePage`
Central class for all UI interactions with methods for:
- Game navigation (`navigateToGame`, `startNewGame`)
- Player state (`getPlayerStats`)
- Movement (`movePlayer` with 8 directions)
- Combat (`attackNearestEnemy`, `getVisibleEnemies`)
- Inventory (`openInventory`, `pickUpItem`, `equipItem`)
- UI panels (`getCombatLog`)

#### Test Organization (7 Suites, 20 Tests)

```
Game Initialization & Setup (3 tests)
├── Game UI displays on startup
├── Player stats show correctly
└── Controls ready at startup

Movement & Exploration (3 tests)
├── Single direction movement
├── All 8-directional movement
└── FOV/visibility updates

Combat Flow (3 tests)
├── Attack execution
├── Combat log display
└── Enemy health updates

Item Management (3 tests)
├── Inventory display
├── Item pickup
└── Inventory updates

Status Effects & Debuffs (3 tests)
├── Status effect display
├── Status icons in UI
└── Effect duration/removal

Boss/Nemesis Encounters (3 tests)
├── Nemesis spawning
├── Nemesis UI
└── Nemesis combat mechanics

Complete Game Loop Journey (2 tests)
├── Full session integration
└── State persistence across panels
```

## Running Tests

```bash
# All tests
npm run test:e2e

# UI mode (interactive)
npm run test:e2e:ui

# Specific suite
npx playwright test --grep "Combat Flow"

# Single test
npx playwright test -g "should attack"

# List all tests
npx playwright test --list tests/e2e/game-loop.spec.ts

# Debug mode
npx playwright test --debug

# With headed browser
npx playwright test --headed
```

## Test Design Patterns

### Resilient Element Selection
Uses multiple selector strategies:
- `data-testid` attributes for reliability
- CSS classes as fallbacks
- Text content matching for robustness

### Explicit Waits
- Wait for element visibility (not hard-coded timeouts)
- Use `locator.waitFor()` with configurable timeouts
- Race conditions handled for phase transitions

### Graceful Error Handling
- Optional UI elements handled with try-catch
- Directions that aren't available skip gracefully
- Tests remain stable even if some features unavailable

### Complete User Journeys
Each test represents a full user journey from start to finish, not individual features.

## Debugging

### Generate Screenshots on Failure
Tests have built-in `takeScreenshot()` method for debugging.

### View Test Report
```bash
npm run test:e2e
# Open playwright-report/index.html
```

### Verbose Logging
```bash
DEBUG=pw:api npx playwright test
```

### Step-by-Step Execution
```bash
npx playwright test --debug
# Use debugger controls in Playwright Inspector
```

## Best Practices

1. **Test Independence**: Each test is completely independent
2. **Descriptive Names**: Test names describe what users do, not technical implementation
3. **Explicit Waits**: Always wait for UI elements, never hard-code timeouts
4. **Single Journey**: Each test covers one complete user journey
5. **UI Verification**: Tests check what users see, not just backend state
6. **Resilient Selectors**: Use data-testid primarily, with fallbacks
7. **Error Recovery**: Handle optional UI gracefully

## Configuration

See `playwright.config.ts` for:
- Base URL: `http://localhost:8080`
- Servers: Automatically started (@dungeon/server, @dungeon/web)
- Reporter: HTML report generation
- Retries: 2x in CI, 0x locally
- Timeout: 30 seconds per test

## Maintenance

### Adding New Tests
1. Add to appropriate test.describe() block
2. Use GamePage methods for interactions
3. Follow naming convention: "should [user action] [expected result]"
4. Include meaningful assertions

### Updating Selectors
Update selectors in the GamePage class methods for centralized maintenance.

### Debugging Failed Tests
1. Check HTML report: `playwright-report/index.html`
2. View screenshots/traces for failures
3. Run with `--debug` flag for step debugging
4. Check browser console for errors

## Test Statistics

- **Total Tests**: 20
- **Lines of Code**: 750
- **Page Object Methods**: 15+
- **User Journeys**: 7
- **Critical Paths**: 6+

## Coverage Summary

✅ Game initialization and UI readiness
✅ Movement in all 8 directions
✅ Combat system integration
✅ Item and inventory management
✅ Status effects application
✅ Boss/nemesis encounter handling
✅ Full game session stability
