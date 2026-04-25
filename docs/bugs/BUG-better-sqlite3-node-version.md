# Bug: better-sqlite3 Node.js Version Mismatch

**Status:** Blocking | Test Coverage Impact  
**Severity:** Medium

## Problem

The `better-sqlite3` native module requires rebuilding for the current Node.js runtime. Tests that depend on `SqliteRepository` fail with:

```
Error: The module '.../better_sqlite3.node' was compiled against a different Node.js version using NODE_MODULE_VERSION 109. This version of Node.js requires NODE_MODULE_VERSION 141.
```

## Impact

- `apps/server/src/sqlite-repository.test.ts` cannot run (integration tests blocked)
- Affects any code that instantiates `SqliteRepository`
- Production code works (if app starts), but test environment is broken

## Root Cause

The `.pnpm/better-sqlite3/build/Release/better_sqlite3.node` binary was compiled against an older Node.js version. This happens when:
- Node.js is upgraded after `pnpm install`
- Different CI environments have different Node versions
- Build artifacts are stale

## Solution

Rebuild the native module:

```bash
# Option 1: Full reinstall
pnpm install --force

# Option 2: Rebuild specific package
npm rebuild better-sqlite3
pnpm rebuild

# Option 3: Delete node_modules and reinstall
rm -rf node_modules .pnpm-lock.yaml
pnpm install
```

## Next Steps

- [ ] Run one of the rebuild commands above
- [ ] Re-run `pnpm test apps/server/src/sqlite-repository.test.ts`
- [ ] Verify 20 integration tests pass
