export function reportDungeonE2EReady(ready: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }

  const hook = window.__DUNGEON_E2E__;
  if (hook?.enabled !== true || hook.api === undefined) {
    return;
  }

  hook.ready = ready;
}
