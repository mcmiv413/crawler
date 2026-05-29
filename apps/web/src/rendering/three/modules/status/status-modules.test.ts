/**
 * Lifecycle contract tests for all status Three animation modules.
 */

import { describe } from 'vitest';
import { runThreeAnimationContract } from '../../testing/run-three-animation-contract.js';
import { goldRingPulse } from './gold-ring-pulse.js';

describe('goldRingPulse', () => { runThreeAnimationContract(goldRingPulse); });
