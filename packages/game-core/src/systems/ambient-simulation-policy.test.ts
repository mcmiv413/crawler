import { describe, it, expect } from 'vitest';
import { getSimulationFidelity, SimulationFidelity } from './ambient-simulation-policy.js';
import { createTestEnemy, createTestPlayer } from '../test-utils.js';

describe('ambient-simulation-policy', () => {
  describe('getSimulationFidelity', () => {
    it('returns High fidelity when distance <= 5', () => {
      const player = createTestPlayer({ position: { x: 0, y: 0 } });
      const enemy = createTestEnemy({ position: { x: 5, y: 0 } });

      const fidelity = getSimulationFidelity(enemy, player);
      expect(fidelity).toBe(SimulationFidelity.High);
    });

    it('returns High fidelity at boundary distance 5', () => {
      const player = createTestPlayer({ position: { x: 0, y: 0 } });
      const enemy = createTestEnemy({ position: { x: 5, y: 0 } });

      const fidelity = getSimulationFidelity(enemy, player);
      expect(fidelity).toBe(SimulationFidelity.High);
    });

    it('returns High fidelity when recently acted (ambientStateAge <= 1)', () => {
      const player = createTestPlayer({ position: { x: 0, y: 0 } });
      const enemy = createTestEnemy({ position: { x: 10, y: 10 }, ambientStateAge: 0 });

      const fidelity = getSimulationFidelity(enemy, player);
      expect(fidelity).toBe(SimulationFidelity.High);
    });

    it('returns High fidelity when ambientStateAge is 1', () => {
      const player = createTestPlayer({ position: { x: 0, y: 0 } });
      const enemy = createTestEnemy({ position: { x: 10, y: 10 }, ambientStateAge: 1 });

      const fidelity = getSimulationFidelity(enemy, player);
      expect(fidelity).toBe(SimulationFidelity.High);
    });

    it('returns Medium fidelity when distance 6-12', () => {
      const player = createTestPlayer({ position: { x: 0, y: 0 } });
      const enemy = createTestEnemy({ position: { x: 9, y: 0 }, ambientStateAge: 5 });

      const fidelity = getSimulationFidelity(enemy, player);
      expect(fidelity).toBe(SimulationFidelity.Medium);
    });

    it('returns Medium fidelity at boundary distance 6', () => {
      const player = createTestPlayer({ position: { x: 0, y: 0 } });
      const enemy = createTestEnemy({ position: { x: 6, y: 0 }, ambientStateAge: 5 });

      const fidelity = getSimulationFidelity(enemy, player);
      expect(fidelity).toBe(SimulationFidelity.Medium);
    });

    it('returns Medium fidelity at boundary distance 12', () => {
      const player = createTestPlayer({ position: { x: 0, y: 0 } });
      const enemy = createTestEnemy({ position: { x: 12, y: 0 }, ambientStateAge: 5 });

      const fidelity = getSimulationFidelity(enemy, player);
      expect(fidelity).toBe(SimulationFidelity.Medium);
    });

    it('returns Low fidelity when distance > 12', () => {
      const player = createTestPlayer({ position: { x: 0, y: 0 } });
      const enemy = createTestEnemy({ position: { x: 13, y: 0 }, ambientStateAge: 5 });

      const fidelity = getSimulationFidelity(enemy, player);
      expect(fidelity).toBe(SimulationFidelity.Low);
    });

    it('returns Low fidelity at large distance', () => {
      const player = createTestPlayer({ position: { x: 0, y: 0 } });
      const enemy = createTestEnemy({ position: { x: 50, y: 50 }, ambientStateAge: 10 });

      const fidelity = getSimulationFidelity(enemy, player);
      expect(fidelity).toBe(SimulationFidelity.Low);
    });

    it('overrides distance with recently acted (High priority)', () => {
      const player = createTestPlayer({ position: { x: 0, y: 0 } });
      // Distance 20, but recently acted (ambientStateAge = 0)
      const enemy = createTestEnemy({ position: { x: 20, y: 0 }, ambientStateAge: 0 });

      const fidelity = getSimulationFidelity(enemy, player);
      expect(fidelity).toBe(SimulationFidelity.High);
    });

    it('overrides distance with recently acted (ambientStateAge = 1)', () => {
      const player = createTestPlayer({ position: { x: 0, y: 0 } });
      const enemy = createTestEnemy({ position: { x: 25, y: 25 }, ambientStateAge: 1 });

      const fidelity = getSimulationFidelity(enemy, player);
      expect(fidelity).toBe(SimulationFidelity.High);
    });

    it('does not override with older state age', () => {
      const player = createTestPlayer({ position: { x: 0, y: 0 } });
      const enemy = createTestEnemy({ position: { x: 20, y: 0 }, ambientStateAge: 2 });

      const fidelity = getSimulationFidelity(enemy, player);
      expect(fidelity).toBe(SimulationFidelity.Low);
    });

    it('handles undefined ambientStateAge as recently acted (defaults to 0)', () => {
      const player = createTestPlayer({ position: { x: 0, y: 0 } });
      const enemy = createTestEnemy({ position: { x: 20, y: 0 }, ambientStateAge: undefined });

      const fidelity = getSimulationFidelity(enemy, player);
      expect(fidelity).toBe(SimulationFidelity.High);
    });

    it('uses Chebyshev distance (max of dx, dy)', () => {
      const player = createTestPlayer({ position: { x: 0, y: 0 } });
      // Chebyshev distance: max(3, 5) = 5
      const enemy = createTestEnemy({ position: { x: 3, y: 5 }, ambientStateAge: 5 });

      const fidelity = getSimulationFidelity(enemy, player);
      expect(fidelity).toBe(SimulationFidelity.High);
    });

    it('uses Chebyshev distance for diagonal movement', () => {
      const player = createTestPlayer({ position: { x: 0, y: 0 } });
      // Chebyshev distance: max(6, 6) = 6
      const enemy = createTestEnemy({ position: { x: 6, y: 6 }, ambientStateAge: 5 });

      const fidelity = getSimulationFidelity(enemy, player);
      expect(fidelity).toBe(SimulationFidelity.Medium);
    });

    it('handles same position as player', () => {
      const player = createTestPlayer({ position: { x: 5, y: 5 } });
      const enemy = createTestEnemy({ position: { x: 5, y: 5 }, ambientStateAge: 10 });

      const fidelity = getSimulationFidelity(enemy, player);
      expect(fidelity).toBe(SimulationFidelity.High);
    });

    it('handles negative coordinates', () => {
      const player = createTestPlayer({ position: { x: -5, y: -5 } });
      // Chebyshev distance: max(|-3 - (-5)|, |-3 - (-5)|) = max(2, 2) = 2
      const enemy = createTestEnemy({ position: { x: -3, y: -3 }, ambientStateAge: 5 });

      const fidelity = getSimulationFidelity(enemy, player);
      expect(fidelity).toBe(SimulationFidelity.High);
    });

    it('returns correct fidelity for distance transitions', () => {
      const player = createTestPlayer({ position: { x: 0, y: 0 } });

      // Distance 5 -> High
      let enemy = createTestEnemy({ position: { x: 5, y: 0 }, ambientStateAge: 5 });
      expect(getSimulationFidelity(enemy, player)).toBe(SimulationFidelity.High);

      // Distance 6 -> Medium
      enemy = createTestEnemy({ position: { x: 6, y: 0 }, ambientStateAge: 5 });
      expect(getSimulationFidelity(enemy, player)).toBe(SimulationFidelity.Medium);

      // Distance 12 -> Medium
      enemy = createTestEnemy({ position: { x: 12, y: 0 }, ambientStateAge: 5 });
      expect(getSimulationFidelity(enemy, player)).toBe(SimulationFidelity.Medium);

      // Distance 13 -> Low
      enemy = createTestEnemy({ position: { x: 13, y: 0 }, ambientStateAge: 5 });
      expect(getSimulationFidelity(enemy, player)).toBe(SimulationFidelity.Low);
    });
  });
});
