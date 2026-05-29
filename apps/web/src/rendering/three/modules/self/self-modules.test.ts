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
