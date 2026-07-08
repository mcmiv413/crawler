/**
 * Test layer: unit
 * Behavior: Status animation modules satisfy the shared Three animation lifecycle contract for goldRingPulse, heatSurgeRing, and arcaneChargeRing.
 * Proof: runThreeAnimationContract assertions check fx ID format, category prefix, create/setPosition/update/dispose no-throw behavior, scene.add/remove counts, tile-scale visible geometry/material opacity, and geometry/material/texture disposal.
 * Validation: pnpm vitest run apps/web/src/rendering/three/modules/status/status-modules.test.ts
 */
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
