import { describe, it, expect } from 'vitest';
import { detectNewThreats } from './threat-detection.js';
import type { EntityView } from '@dungeon/presenter';

function makeEnemy(id: string): EntityView {
  return { id, x: 0, y: 0, ascii: 'E', color: '#f00', name: 'Enemy', type: 'enemy', health: 10, maxHealth: 10, templateId: 'rat' };
}

describe('detectNewThreats', () => {
  it('returns empty when no new enemies', () => {
    const known = new Set(['e1', 'e2']);
    const current = [makeEnemy('e1'), makeEnemy('e2')];
    expect(detectNewThreats(known, current)).toEqual([]);
  });

  it('detects newly visible enemy (ID not in known set)', () => {
    const known = new Set(['e1']);
    const current = [makeEnemy('e1'), makeEnemy('e2')];
    const threats = detectNewThreats(known, current);
    expect(threats).toHaveLength(1);
    expect(threats[0]!.id).toBe('e2');
  });

  it('ignores enemies already in known set', () => {
    const known = new Set(['e1', 'e2', 'e3']);
    const current = [makeEnemy('e1'), makeEnemy('e2')];
    expect(detectNewThreats(known, current)).toEqual([]);
  });

  it('handles multiple new enemies at once', () => {
    const known = new Set<string>();
    const current = [makeEnemy('e1'), makeEnemy('e2'), makeEnemy('e3')];
    const threats = detectNewThreats(known, current);
    expect(threats).toHaveLength(3);
  });
});
