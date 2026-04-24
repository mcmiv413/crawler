# How to Add a New Game Mechanic

## Overview

Every game mechanic must complete the **6-hop end-to-end chain**. If any hop is missing, the feature is incomplete — it either can't be triggered, can't be seen, or can't be tested.

---

## The 6-Hop Chain

```
1. Entry Point → 2. State Change → 3. Event Emission → 4. Presenter Output → 5. UI Render → 6. Test
```

| Hop | Question to answer | Where |
|-----|-------------------|-------|
| **1. Entry** | How does the player trigger this? | Command in `game-contracts`, handler in `game-core/engine/` |
| **2. State** | What changes in GameState? | System in `game-core/src/systems/` |
| **3. Event** | What DomainEvent fires? | Event type in `game-contracts/src/events/` |
| **4. Presenter** | How does the view expose this? | Builder in `presenter/src/builders/` |
| **5. UI** | What does the player see? | Component in `apps/web/src/components/` |
| **6. Test** | Does the test prove all hops? | `assertFeatureChain()` validates the chain |

---

## Step-by-Step Implementation

### 1. Define the Command

`packages/game-contracts/src/commands/index.ts`:
```typescript
| { type: 'MY_COMMAND'; someParam: string }
```

Add Zod schema in `packages/game-contracts/src/schemas/index.ts`.

### 2. Create the System

`packages/game-core/src/systems/my-feature.ts`:
```typescript
export function handleMyFeature(
  state: GameState, params: MyParams, rng: RNG
): { state: GameState; events: DomainEvent[] } {
  // Compute new state (immutably!)
  const newState = { ...state, /* changes */ };
  const events = [{ type: 'MY_FEATURE_ACTIVATED', /* data */ }];
  return { state: newState, events };
}
```

**Rules:**
- Pure function — no side effects
- Return new state, never mutate input
- Always emit at least one event for player-visible changes

### 3. Route the Command

`packages/game-core/src/engine/command-handler.ts`:
```typescript
case 'MY_COMMAND':
  return handleMyFeature(state, command, rng);
```

### 4. Define the Event

`packages/game-contracts/src/events/index.ts`:
```typescript
interface MyFeatureActivatedEvent {
  type: 'MY_FEATURE_ACTIVATED';
  // ... relevant data fields
}
```

Add to the `DomainEvent` union.

### 5. Format the Event

`packages/presenter/src/event-formatter.ts`:
```typescript
case 'MY_FEATURE_ACTIVATED':
  return { text: 'Something cool happened!', type: 'info', timestamp };
```

### 6. Expose in Presenter

If the feature adds new view data beyond combat log text, update the relevant builder in `packages/presenter/src/builders/` and the `GameView` type in `packages/presenter/src/game-view.ts`.

### 7. Render in UI

Add or update component in `apps/web/src/components/` to display the new view data.

### 8. Test the Full Chain

```typescript
import { assertFeatureChain } from '@dungeon/presenter/testing';

it('my feature works end-to-end', () => {
  const before = createTestState();
  const result = handleMyFeature(before, params, rng);
  assertFeatureChain(result, before, { eventType: 'MY_FEATURE_ACTIVATED' });
});
```

---

## Common Incomplete Feature Patterns

| Symptom | Missing hop | Fix |
|---------|------------|-----|
| Feature works but player sees nothing | No event emitted | Add event to return value |
| Event emitted but combat log empty | No formatter | Add case to `event-formatter.ts` |
| Data exists but UI blank | Presenter doesn't expose it | Update view builder |
| UI component exists but never shows data | View doesn't include field | Add to `GameView` type + builder |
| Test passes but feature broken in-game | Test only checks state | Use `assertFeatureChain()` |

---

## Feature Completeness Checklist

Before marking done:

- [ ] **Entry** — UI action or game event triggers the feature
- [ ] **State** — GameState updates immutably
- [ ] **Event** — DomainEvent emitted with all required fields
- [ ] **Format** — `formatEvent()` returns non-null, readable text
- [ ] **View** — `buildGameView()` exposes data to frontend
- [ ] **UI** — React component renders the view data
- [ ] **Test** — `assertFeatureChain()` validates the chain
- [ ] **Validate** — `pnpm validate` passes

---

## Integration Points

### Turn Scheduling
If your mechanic needs to run during NPC turns (e.g., status procs, environmental effects):
- Wire into `packages/game-core/src/engine/turn-scheduler.ts`

### Dungeon Generation
If your mechanic affects floor creation:
- `packages/game-core/src/generation/floor-populator.ts`
- `packages/game-core/src/generation/map-generator.ts`

### Town Phase
If your mechanic is a town action:
- `packages/game-core/src/systems/town.ts`
- `packages/presenter/src/builders/town-view-builder.ts`

---

## Key File Reference

| Layer | File |
|-------|------|
| Commands | `packages/game-contracts/src/commands/index.ts` |
| Events | `packages/game-contracts/src/events/index.ts` |
| Schemas | `packages/game-contracts/src/schemas/index.ts` |
| Engine routing | `packages/game-core/src/engine/command-handler.ts` |
| Turn scheduling | `packages/game-core/src/engine/turn-scheduler.ts` |
| Event formatting | `packages/presenter/src/event-formatter.ts` |
| View types | `packages/presenter/src/game-view.ts` |
| View building | `packages/presenter/src/game-view-builder.ts` |
| Test helpers | `packages/presenter/src/testing/feature-chain-helpers.ts` |
