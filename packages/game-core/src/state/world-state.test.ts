import { describe, it, expect } from 'vitest';
import { createInitialWorldState } from './world-state.js';
import { SeededRNG } from '../utils/rng.js';

describe('Initial World State - Shop', () => {
  it('includes Fire Ring in shop', () => {
    const rng = new SeededRNG(12345);
    const world = createInitialWorldState(rng);

    const fireRingInShop = world.shop.items.some(item => item.itemId === 'fire_ring');

    expect(fireRingInShop).toBe(true);
  });

  it('Fire Ring is properly priced', () => {
    const rng = new SeededRNG(12345);
    const world = createInitialWorldState(rng);

    const fireRing = world.shop.items.find(item => item.itemId === 'fire_ring');

    expect(fireRing).toBeDefined();
    expect(fireRing!.price).toBeGreaterThan(0);
    expect(fireRing!.stock).toBe(1);
  });
});
