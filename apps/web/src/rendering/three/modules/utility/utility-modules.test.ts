/**
 * Test layer: unit
 * Behavior: Utility Modules covers trapSpark; trapPlacement.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run apps/web/src/rendering/three/modules/utility/utility-modules.test.ts
 */
/**
 * Lifecycle contract tests for all utility Three animation modules.
 */

import { describe } from 'vitest';
import { runThreeAnimationContract } from '../../testing/run-three-animation-contract.js';
import { trapSpark } from './trap-spark.js';
import { trapPlacement } from './trap-placement.js';

describe('trapSpark', () => { runThreeAnimationContract(trapSpark); });
describe('trapPlacement', () => { runThreeAnimationContract(trapPlacement); });
