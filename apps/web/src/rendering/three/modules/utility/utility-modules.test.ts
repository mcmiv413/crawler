/**
 * Lifecycle contract tests for all utility Three animation modules.
 */

import { describe } from 'vitest';
import { runThreeAnimationContract } from '../../testing/run-three-animation-contract.js';
import { trapSpark } from './trap-spark.js';
import { trapPlacement } from './trap-placement.js';

describe('trapSpark', () => { runThreeAnimationContract(trapSpark); });
describe('trapPlacement', () => { runThreeAnimationContract(trapPlacement); });
