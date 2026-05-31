---
name: adding-game-mechanic
description: Add a new end-to-end game mechanic in this repo. Use whenever the prompt asks for a new system, combat mechanic, town mechanic, dungeon mechanic, command-driven feature, or other gameplay change that needs command or entry wiring, state changes, events, presenter output, UI rendering, and tests, even if the user only says things like "add a new mechanic", "implement this feature end to end", "add a new town action", or "make this gameplay system visible in the UI."
---

# Adding Game Mechanic

Add a feature through the repo's full **6-hop chain**. This skill is for mechanics that need entry wiring, state updates, events, presenter data, UI rendering, and proofs.

## Load these references when needed

- Read `references/six-hop-checklist.md` for the file map, proof matrix, and escalation rules.
- Read `../../guides/adding-mechanic.md` when you need the full 6-hop guide or integration-point detail.

## Core rules

1. Every player-visible mechanic must complete the 6-hop chain: entry, state, event, presenter, UI, test.
2. Keep content static. Put runtime decisions in `game-core` or `server`.
3. Keep presenter output display-ready. Do not make the web duplicate content or formatting logic.
4. If the feature references live content IDs, require contract coverage.
5. If the state shape changes, cover schema, persistence, defaults, restore compatibility, and presenter compatibility.
6. Use the lightest correct proofs while iterating, but finish on `pnpm validate`.

## Workflow

1. Identify the feature entry point: command, town action, scheduled effect, or another explicit trigger.
2. Name the state change and the system or handler that owns it.
3. Name the emitted event and the formatter or view surface that exposes it.
4. Name the presenter builder and UI component that will show the feature.
5. Decide whether the feature also needs content declarations, contract tests, or animation support.
6. Choose proofs that actually cover the player-visible chain.

## Escalation rules

### Content-backed mechanics

If the mechanic adds new catalog data:

- create source files under `packages/content/src/**`
- reuse imported definitions or dot-walked refs where practical
- run `pnpm generate:indexes`
- add contract tests when live IDs are referenced

### State-shape changes

If the mechanic changes persisted state:

- update schemas and validators
- handle defaults, migrations, and restore compatibility
- make sure presenter builders remain compatible

### Animation-backed mechanics

If the mechanic needs new visuals:

- keep mechanic ownership here
- route animation specifics through the animation workflow instead of hand-waving them away

## Output contract

When answering a mechanic request, return:

- the 6-hop file map
- any content/schema/persistence additions
- whether animation or contract work is also required
- the proof homes for the mechanic

Do not stop at only the system or only the UI. The value of this skill is the **full chain**.

## Examples

**Example 1:**

Input: "Add a new town action that lets the player study a relic."

Output:
- names the town action entry path
- names the system, event, presenter, and UI surfaces
- calls out contract work if the action references live relic IDs
- ends with tests that prove the feature chain

**Example 2:**

Input: "Add a combat mechanic where poison stacks and shows in the HUD."

Output:
- names state, event, presenter, and HUD surfaces
- calls out status or animation follow-up when needed
- requires proofs beyond a state-only unit test

## Failure modes to avoid

- Do not treat a new mechanic as only a system change.
- Do not leave player-visible changes without an event or presenter surface.
- Do not put runtime decisions in `packages/content`.
- Do not skip contract tests when live IDs are involved.
- Do not finish on targeted proofs alone; the merge gate is `pnpm validate`.
