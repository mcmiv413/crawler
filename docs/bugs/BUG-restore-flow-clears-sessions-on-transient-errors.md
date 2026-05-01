# BUG: restore flow clears sessions on transient errors

**Status:** Resolved
**Severity:** High
**Files:** `apps/server/src/app.ts`, `apps/web/src/store/game-store.ts`, `apps/server/src/api/game-routes.test.ts`

## Description

The restore API and the web restore flow both collapse unexpected runtime failures into "bad save" handling. On the server, the restore route returns HTTP 400 with `Failed to deserialize game state` for unknown failures inside the restore path. On the client, `restoreSession()` clears session storage on any restore failure, treating transient server or network issues as permanent save corruption.

That means a recoverable failure during warm-load, cold-start rehydration, or persistence can wipe the user's local session and hide the real server fault.

## Root Cause

- `apps/server/src/app.ts` wraps the restore flow in a broad catch and maps unknown failures to a client-error response
- `apps/web/src/store/game-store.ts` catches any restore failure and immediately clears the saved session
- `apps/server/src/api/game-routes.test.ts` only covers success and malformed-input branches, so runtime-failure behavior is not pinned down

## Impact

- Temporary server or network failures can cause avoidable session loss
- Server-side restore bugs are misreported as client save corruption
- Restore regressions can ship without test coverage for the failure paths that matter most

## Resolution

- the server restore route now returns 400 only for invalid/incompatible saves and 500 for unexpected restore failures
- the web store only clears local session state on confirmed invalid-save errors
- restore tests now cover warm-load and cold-start failure branches so transient failures no longer masquerade as corruption
