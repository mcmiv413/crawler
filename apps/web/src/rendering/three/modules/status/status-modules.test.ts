/**
 * Lifecycle contract tests for all status Three animation modules.
 */

import { describe } from 'vitest';
import { runThreeAnimationContract } from '../../testing/run-three-animation-contract.js';
import { arcaneChargeRing } from './arcane-charge-ring.js';
import { goldRingPulse } from './gold-ring-pulse.js';
import { heatSurgeRing } from './heat-surge-ring.js';

describe('goldRingPulse', () => { runThreeAnimationContract(goldRingPulse); });
describe('heatSurgeRing', () => { runThreeAnimationContract(heatSurgeRing); });
describe('arcaneChargeRing', () => { runThreeAnimationContract(arcaneChargeRing); });
