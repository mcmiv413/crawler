/**
 * Test layer: unit
 * Behavior: AOE animation modules satisfy the shared Three animation lifecycle contract for bombBlast, cleaveArc, shatterBurst, and cinderWake.
 * Proof: runThreeAnimationContract assertions check fx ID format, category prefix, create/setPosition/update/dispose no-throw behavior, scene.add/remove counts, tile-scale visible geometry/material opacity, and geometry/material/texture disposal.
 * Validation: pnpm vitest run apps/web/src/rendering/three/modules/aoe/aoe-modules.test.ts
 */
/**
 * Lifecycle contract tests for all aoe Three animation modules.
 */

import { describe } from 'vitest';
import { runThreeAnimationContract } from '../../testing/run-three-animation-contract.js';
import { bombBlast } from './bomb-blast.js';
import { cleaveArc } from './cleave-arc.js';
import { shatterBurst } from './shatter-burst.js';
import { cinderWake } from './cinder-wake.js';

describe('bombBlast', () => { runThreeAnimationContract(bombBlast); });
describe('cleaveArc (aoe)', () => { runThreeAnimationContract(cleaveArc); });
describe('shatterBurst (aoe)', () => { runThreeAnimationContract(shatterBurst); });
describe('cinderWake', () => { runThreeAnimationContract(cinderWake); });
