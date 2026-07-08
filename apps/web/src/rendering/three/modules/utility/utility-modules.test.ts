/**
 * Test layer: unit
 * Behavior: Utility animation modules satisfy the shared Three animation lifecycle contract for trapSpark and trapPlacement.
 * Proof: runThreeAnimationContract assertions check fx ID format, category prefix, create/setPosition/update/dispose no-throw behavior, scene.add/remove counts, tile-scale visible geometry/material opacity, and geometry/material/texture disposal.
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
