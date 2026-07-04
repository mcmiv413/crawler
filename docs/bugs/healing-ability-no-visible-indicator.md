---
title: Healing abilities produce no visible combat indicator
status: open
date: 2026-07-04
---

# Healing Abilities Produce No Visible Combat Indicator

## Symptom

Healing abilities do not show a visible `+HP` combat indicator. In the E2E scenario fixture, Second Wind restores 19 HP, but no healing indicator appears.

## Reproduction

Remove the `test.fixme` annotation from the documented expected-failure, then run:

```bash
pnpm playwright test tests/e2e/combat-indicators.spec.ts --grep "scenario healing ability shows a visible healing combat indicator"
```

The healing state change succeeds, but the assertion waiting for a visible `+19` indicator fails.

## Expected

A healing ability produces a visible positive-value combat indicator for the amount healed.

## Actual

Production responses build animation events through `buildAnimationSequence()`. Its ability path emits only ability and damage events, so healing never reaches the combat-indicator rendering pipeline. The legacy `buildCombatIndicators()` path supported healing indicators.

## Suspected Fix Location

Update the `buildAnimationSequence()` ability path to emit a heal event when the ability restores health.

## Missing 6-Hop Chain Hops

- **Event** — the animation sequence does not emit a heal event for the successful health restoration.
- **Presenter/animation** — no healing animation or combat-indicator presentation is derived from the response.
- **UI** — no visible positive-value healing indicator is rendered.

