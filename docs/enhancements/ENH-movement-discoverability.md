# ENH: make dungeon movement controls easier to discover

**Status:** Proposed
**Priority:** Medium
**Area:** `apps/web` dungeon input and onboarding UX

## Summary

New players can reach the dungeon and still miss how movement works if they do not already expect arrow-key controls or tile clicking.

Movement is functional, but the current UI emphasizes action buttons like `Wait`, `Attack`, `Interact`, and `Inspect` without clearly teaching the primary navigation model.

## Evidence

- a fresh playtest reached the dungeon without any explicit movement hint
- the action bar does not expose movement as an action
- keyboard movement works, but the UI does not advertise arrow keys
- click-to-move depends on understanding that only visible floor tiles are valid targets

## Impact

- first-time players may think the dungeon is unresponsive or incomplete
- desktop players may not discover tile-click movement quickly
- onboarding friction appears before the player reaches the first combat loop

## Enhancement Ideas

- add a short first-floor hint such as `Move with arrow keys or click a visible floor tile`
- surface movement help near the dungeon action bar until the player moves once
- show a lightweight invalid-target response when the player clicks a wall or unexplored space
- consider a small help affordance or controls legend in the dungeon HUD
