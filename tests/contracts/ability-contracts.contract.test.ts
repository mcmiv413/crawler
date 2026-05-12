import { describe, expect, it } from 'vitest';
import {
  collectAbilityContractFailures,
  createLiveAbilityContractSnapshot,
} from '../../scripts/check-ability-contracts.js';

describe('Ability Contracts', () => {
  it('keeps live ability metadata aligned with animation refs and public command payloads', () => {
    expect(collectAbilityContractFailures(createLiveAbilityContractSnapshot())).toEqual([]);
  });
});
