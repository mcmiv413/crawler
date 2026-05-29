type ViteFeatureEnv = ImportMetaEnv & Record<string, string | boolean | undefined>;

export type AnimationRendererMode = 'canvas' | 'three';

declare global {
  var __DUNGEON_BEAT_SCHEDULER_OVERRIDE__: boolean | undefined;
  var __DUNGEON_THREE_EFFECTS_OVERRIDE__: boolean | undefined;
  var __DUNGEON_ANIMATION_RENDERER_MODE_OVERRIDE__: AnimationRendererMode | undefined;
}

export function isBeatSchedulerEnabledFlag(): boolean {
  if (globalThis.__DUNGEON_BEAT_SCHEDULER_OVERRIDE__ !== undefined) {
    return globalThis.__DUNGEON_BEAT_SCHEDULER_OVERRIDE__;
  }

  const env = import.meta.env as ViteFeatureEnv;
  const beatScheduler = env['VITE_BEAT_SCHEDULER'];

  return beatScheduler !== 'false' && beatScheduler !== false;
}

export function getAnimationRendererMode(): AnimationRendererMode {
  if (globalThis.__DUNGEON_ANIMATION_RENDERER_MODE_OVERRIDE__ !== undefined) {
    return globalThis.__DUNGEON_ANIMATION_RENDERER_MODE_OVERRIDE__;
  }

  const env = import.meta.env as ViteFeatureEnv;
  const mode = env['VITE_ANIMATION_RENDERER_MODE'];

  if (mode === 'three') {
    return 'three';
  }

  if (mode === 'canvas') {
    return 'canvas';
  }

  // Default to the proven canvas path until the full Three renderer is ready.
  return 'canvas';
}

export function isThreeEffectsEnabledFlag(): boolean {
  return getAnimationRendererMode() === 'three';
}
