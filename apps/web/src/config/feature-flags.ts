type ViteFeatureEnv = ImportMetaEnv & Record<string, string | boolean | undefined>;

declare global {
  var __DUNGEON_BEAT_SCHEDULER_OVERRIDE__: boolean | undefined;
}

export function isBeatSchedulerEnabledFlag(): boolean {
  if (globalThis.__DUNGEON_BEAT_SCHEDULER_OVERRIDE__ !== undefined) {
    return globalThis.__DUNGEON_BEAT_SCHEDULER_OVERRIDE__;
  }

  const env = import.meta.env as ViteFeatureEnv;
  const beatScheduler = env['VITE_BEAT_SCHEDULER'];

  return beatScheduler !== 'false' && beatScheduler !== false;
}
