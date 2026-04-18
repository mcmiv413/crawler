import { describe, it, expect } from 'vitest';
import { hazardTypeToDamageType } from './hazard-damage.js';

describe('hazard-damage', () => {
  describe('hazardTypeToDamageType', () => {
    it('maps spike to physical', () => {
      expect(hazardTypeToDamageType('spike')).toBe('physical');
    });

    it('maps fire to fire', () => {
      expect(hazardTypeToDamageType('fire')).toBe('fire');
    });

    it('maps poison to poison', () => {
      expect(hazardTypeToDamageType('poison')).toBe('poison');
    });

    it('maps frost to frost', () => {
      expect(hazardTypeToDamageType('frost')).toBe('frost');
    });

    it('maps lightning to shock', () => {
      expect(hazardTypeToDamageType('lightning')).toBe('shock');
    });
  });
});
