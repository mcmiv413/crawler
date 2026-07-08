/**
 * Test layer: unit
 * Behavior: Self-target animation modules satisfy the shared Three animation lifecycle contract for healingPulse, staminaSurge, cureSparkle, secondWindBuff, and heatSurgeAura.
 * Proof: runThreeAnimationContract assertions check fx ID format, category prefix, create/setPosition/update/dispose no-throw behavior, scene.add/remove counts, tile-scale visible geometry/material opacity, and geometry/material/texture disposal.
 * Validation: pnpm vitest run apps/web/src/rendering/three/modules/self/self-modules.test.ts
 */
/**
 * Lifecycle contract tests for all self Three animation modules.
 */

import { describe } from 'vitest';
import { runThreeAnimationContract } from '../../testing/run-three-animation-contract.js';
import { healingPulse } from './healing-pulse.js';
import { staminaSurge } from './stamina-surge.js';
import { cureSparkle } from './cure-sparkle.js';
import { secondWindBuff } from './second-wind-buff.js';
import { heatSurgeAura } from './heat-surge-aura.js';

describe('healingPulse', () => { runThreeAnimationContract(healingPulse); });
describe('staminaSurge', () => { runThreeAnimationContract(staminaSurge); });
describe('cureSparkle', () => { runThreeAnimationContract(cureSparkle); });
describe('secondWindBuff', () => { runThreeAnimationContract(secondWindBuff); });
describe('heatSurgeAura', () => { runThreeAnimationContract(heatSurgeAura); });
