import { describe, it, expect } from 'vitest';
import { WEAPONS } from './weapons/index.js';
import { WEAPON_TYPES } from '@dungeon/contracts';

describe('WEAPONS', () => {
  it('every weapon has weaponType defined', () => {
    for (const w of WEAPONS) {
      expect(w.weapon.weaponType, `${w.itemId} missing weaponType`).toBeDefined();
    }
  });

  it('every weapon damage >= 1', () => {
    for (const w of WEAPONS) {
      expect(w.weapon.damage, `${w.itemId} damage < 1`).toBeGreaterThanOrEqual(1);
    }
  });

  it('every weapon type has at least one weapon', () => {
    for (const weaponType of WEAPON_TYPES) {
      const count = WEAPONS.filter(w => w.weapon.weaponType === weaponType).length;
      expect(count, `no weapons of type ${weaponType}`).toBeGreaterThan(0);
    }
  });

  it('rusty_sword damage === 3', () => {
    const w = WEAPONS.find(w => w.itemId === 'rusty_sword');
    expect(w?.weapon.damage).toBe(3);
  });

  it('frost_axe damage === 10', () => {
    const w = WEAPONS.find(w => w.itemId === 'frost_axe');
    expect(w?.weapon.damage).toBe(10);
  });

  it('rarity tier damage scaling: common < uncommon < rare', () => {
    const common = WEAPONS.filter(w => w.rarity === 'common');
    const uncommon = WEAPONS.filter(w => w.rarity === 'uncommon');
    const rare = WEAPONS.filter(w => w.rarity === 'rare');

    const commonMax = Math.max(...common.map(w => w.weapon.damage));
    const uncommonMin = Math.min(...uncommon.map(w => w.weapon.damage));
    const rareMin = Math.min(...rare.map(w => w.weapon.damage));

    expect(commonMax).toBeLessThanOrEqual(uncommonMin);
    expect(uncommonMin).toBeLessThanOrEqual(rareMin);
  });

  it('iron_mace damage === 5', () => {
    const w = WEAPONS.find(w => w.itemId === 'iron_mace');
    expect(w?.weapon.damage).toBe(5);
  });

  it('short_bow damage === 3', () => {
    const w = WEAPONS.find(w => w.itemId === 'short_bow');
    expect(w?.weapon.damage).toBe(3);
  });

  it('flame_dagger damage === 5', () => {
    const w = WEAPONS.find(w => w.itemId === 'flame_dagger');
    expect(w?.weapon.damage).toBe(5);
  });

  it('venom_blade damage === 6', () => {
    const w = WEAPONS.find(w => w.itemId === 'venom_blade');
    expect(w?.weapon.damage).toBe(6);
  });

  it('war_bow damage === 6', () => {
    const w = WEAPONS.find(w => w.itemId === 'war_bow');
    expect(w?.weapon.damage).toBe(6);
  });

  it('stone_hammer damage === 7', () => {
    const w = WEAPONS.find(w => w.itemId === 'stone_hammer');
    expect(w?.weapon.damage).toBe(7);
  });

  it('iron_sword damage === 10', () => {
    const w = WEAPONS.find(w => w.itemId === 'iron_sword');
    expect(w?.weapon.damage).toBe(10);
  });

  it('frost_axe speed === 0', () => {
    const w = WEAPONS.find(w => w.itemId === 'frost_axe');
    expect(w?.weapon.speed).toBe(0);
  });

  it('flame_dagger speed === 10', () => {
    const w = WEAPONS.find(w => w.itemId === 'flame_dagger');
    expect(w?.weapon.speed).toBe(10);
  });

  it('has weapons defined', () => {
    expect(WEAPONS.length).toBeGreaterThan(0);
  });
});
