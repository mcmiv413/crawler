import { describe, it, expect } from 'vitest';
import {
  canAffordMana,
  deductMana,
  restoreMana,
  regenerateMana,
} from './mana.js';

describe('Mana System', () => {
  describe('canAffordMana', () => {
    it('returns true when current mana >= cost', () => {
      const cost = 5;

      expect(canAffordMana(cost * 2, cost)).toBe(true);
      expect(canAffordMana(cost, cost)).toBe(true);
    });

    it('returns false when current mana < cost', () => {
      const cost = 5;

      expect(canAffordMana(cost - 1, cost)).toBe(false);
      expect(canAffordMana(0, 1)).toBe(false);
    });
  });

  describe('deductMana', () => {
    it('reduces mana by cost amount', () => {
      const currentMana = 10;
      const cost = 3;
      const lowMana = cost - 1;

      expect(deductMana(currentMana, cost)).toBe(currentMana - cost);
      expect(deductMana(cost + lowMana, cost)).toBe(lowMana);
    });

    it('returns 0 when cost exceeds current mana', () => {
      const currentMana = 3;
      const cost = 5;
      const depletedMana = Math.max(0, currentMana - cost);

      expect(deductMana(currentMana, cost)).toBe(depletedMana);
      expect(deductMana(depletedMana, 1)).toBe(depletedMana);
    });
  });

  describe('restoreMana', () => {
    it('adds mana amount up to max', () => {
      const currentMana = 5;
      const amount = 3;
      const maxMana = 10;

      expect(restoreMana(currentMana, maxMana, amount)).toBe(currentMana + amount);
      expect(restoreMana(0, maxMana * 2, maxMana + amount + 2)).toBe(maxMana + amount + 2);
    });

    it('caps mana at max', () => {
      const maxMana = 20;

      expect(restoreMana(maxMana - 2, maxMana, 5)).toBe(maxMana);
      expect(restoreMana(maxMana, maxMana, 10)).toBe(maxMana);
    });
  });

  describe('regenerateMana', () => {
    it('increases mana by 1 up to max', () => {
      const currentMana = 10;
      const maxMana = 20;
      const regeneratedMana = regenerateMana(currentMana, maxMana);

      expect(regeneratedMana).toBeGreaterThan(currentMana);
      expect(regenerateMana(0, maxMana)).toBe(regeneratedMana - currentMana);
    });

    it('caps mana at max', () => {
      const maxMana = 20;

      expect(regenerateMana(maxMana - 1, maxMana)).toBe(maxMana);
      expect(regenerateMana(maxMana, maxMana)).toBe(maxMana);
    });
  });
});
