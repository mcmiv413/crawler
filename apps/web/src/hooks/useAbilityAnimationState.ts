import type { AbilityAnimationEntry } from '@dungeon/presenter';
import { createFxHook } from './useFxAnimationState.js';

export const useAbilityAnimationState = createFxHook<AbilityAnimationEntry>('ability');
