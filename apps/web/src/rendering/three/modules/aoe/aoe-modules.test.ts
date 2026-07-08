/**
 * Test layer: unit
 * Behavior: aoe Modules covers bombBlast; cleaveArc (aoe); shatterBurst (aoe).
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
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
