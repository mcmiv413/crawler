/**
 * Test layer: unit
 * Behavior: Self Modules covers healingPulse; staminaSurge; cureSparkle.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
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
