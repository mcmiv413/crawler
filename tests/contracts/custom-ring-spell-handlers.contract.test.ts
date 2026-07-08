/**
 * Test layer: contract
 * Behavior: Custom ring spell content and runtime handler registration stay in one-to-one effectHandlerId alignment.
 * Proof: Expectations require no custom RING_SPELL_BY_ID entries missing effectHandlerId, no custom spells missing registered handlers, no registered handler ids without matching custom spells, and no duplicate effectHandlerIds.
 * Validation: pnpm vitest run tests/contracts/custom-ring-spell-handlers.contract.test.ts
 */
import { describe, it, expect } from 'vitest';
import { RING_SPELL_BY_ID } from '@dungeon/content';
import { getAllCustomRingSpellHandlerIds } from '../../packages/game-core/src/engine/custom-ring-spell-handlers.js';

/**
 * Custom Ring Spell Handler Registry Contract
 *
 * Ensures every custom ring spell in content has exactly one registered runtime handler.
 * Also validates that every registered handler ID maps to a custom ring spell with that effectHandlerId.
 *
 * This prevents mismatches between content definitions and runtime implementations.
 */

describe('Custom Ring Spell Handlers Contract', () => {
  it('every custom ring spell has an effectHandlerId', () => {
    const customSpells = Array.from(RING_SPELL_BY_ID.values()).filter(
      spell => spell.effectKind === 'custom'
    );

    const missing = customSpells.filter(spell => !spell.effectHandlerId);
    expect(missing).toEqual(
      [],
      `Custom ring spells must have effectHandlerId: ${missing.map(s => s.id).join(', ')}`
    );
  });

  it('every custom ring spell effectHandlerId has a registered handler', () => {
    const registeredIds = getAllCustomRingSpellHandlerIds();
    const registeredSet = new Set(registeredIds);

    const customSpells = Array.from(RING_SPELL_BY_ID.values()).filter(
      spell => spell.effectKind === 'custom'
    );

    const missing = customSpells.filter(spell => !registeredSet.has(spell.effectHandlerId!));
    expect(missing).toEqual(
      [],
      `Custom ring spells missing registered handlers: ${missing.map(s => `${s.id} (handler: ${s.effectHandlerId})`).join(', ')}`
    );
  });

  it('every registered handler corresponds to a custom ring spell with that effectHandlerId', () => {
    const registeredIds = getAllCustomRingSpellHandlerIds();
    const customSpellsByHandlerId = new Map<string, string>();

    for (const spell of RING_SPELL_BY_ID.values()) {
      if (spell.effectKind === 'custom' && spell.effectHandlerId) {
        customSpellsByHandlerId.set(spell.effectHandlerId, spell.id);
      }
    }

    const unmatched = registeredIds.filter(handlerId => !customSpellsByHandlerId.has(handlerId));
    expect(unmatched).toEqual(
      [],
      `Registered handlers without matching custom ring spells: ${unmatched.join(', ')}`
    );
  });

  it('each effectHandlerId is unique within custom ring spells', () => {
    const customSpells = Array.from(RING_SPELL_BY_ID.values()).filter(
      spell => spell.effectKind === 'custom'
    );

    const handlerIds = customSpells.map(spell => spell.effectHandlerId);
    const uniqueIds = new Set(handlerIds);

    expect(handlerIds.length).toBe(
      uniqueIds.size,
      `Duplicate effectHandlerIds found: ${handlerIds.filter((id, i) => handlerIds.indexOf(id) !== i).join(', ')}`
    );
  });
});
