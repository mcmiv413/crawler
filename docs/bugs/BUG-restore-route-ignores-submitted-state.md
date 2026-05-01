# BUG: restore route ignores submitted state when the same game already exists

**Status:** Fixed
**Severity:** High
**Files:** `apps/server/src/app.ts`, `apps/web/src/store/game-store.ts`, `apps/server/src/api/game-routes.test.ts`

## Description

The restore API accepts a client-supplied serialized save, deserializes it, and then immediately returns the repository copy when `repo.loadGame(state.gameId)` succeeds.

That means a cold-start restore can silently discard the submitted client state and return an older server snapshot with the same `gameId`.

## Root Cause

- `apps/server/src/app.ts` treats any existing `gameId` as a successful warm restore
- the route does not compare the submitted payload to the stored state before returning
- `apps/web/src/store/game-store.ts` relies on `/api/games/restore` to recover after server cold starts or `GameNotFoundError`
- `apps/server/src/api/game-routes.test.ts` pins the current "returns existing game" behavior but does not cover divergent payloads

## Impact

- restore can become a silent no-op when local session state is newer than the server copy
- client and server state can diverge without an explicit error or conflict signal
- debugging restore regressions is harder because the API reports success for mismatched state

## Fix

- define explicit restore collision semantics for existing `gameId` values
- compare submitted and stored state before returning the warm copy
- return a conflict or explicit overwrite flow when the payload differs
- add server and web tests for equal-payload, divergent-payload, and transient-failure paths

## Resolution

- `apps/server/src/app.ts` now canonicalizes the submitted save and compares it with the stored state before using the warm path
- divergent saves now return `409 RESTORE_STATE_CONFLICT` instead of silently replacing the submitted payload
- restore client/store tests now cover conflict handling while preserving the browser-stored session
