import { describe, it, expect } from 'vitest';
import {
  analyzeTestFile,
  type TestAnalysisResult,
} from './test-layer-advisor.js';
import {
  generateBuilder,
  listAvailableBuilders,
} from './test-builder-generator.js';

describe('test-layer-advisor skill', () => {
  describe('analyzeTestFile', () => {
    it('validates unit test with correct patterns', () => {
      const code = `
import { describe, it, expect } from 'vitest';
import { PlayerBuilder } from '../testing/builders/character-builder.js';
import { SeededRng } from '../testing/rng.js';

describe('PlayerStats', () => {
  it('calculates defense bonus correctly', () => {
    const rng = new SeededRng(42);
    const player = new PlayerBuilder().withStats({ defense: 5 }).build();
    expect(player.stats.defense).toBeGreaterThan(0);
  });
});
      `;

      const result = analyzeTestFile(code, 'unit');
      expect(result.layer).toBe('unit');
      expect(result.validated).toBe(true);
      expect(result.issues.length).toBe(0);
    });

    it('flags unit test importing live config', () => {
      const code = `
import { PLAYER_STATS } from '@dungeon/content';

describe('PlayerStats', () => {
  it('matches config', () => {
    expect(PLAYER_STATS.maxHealth).toBe(100);
  });
});
      `;

      const result = analyzeTestFile(code, 'unit');
      expect(result.issues.length).toBeGreaterThan(0);
      const configIssue = result.issues.find((i) => i.code === 'CONFIG_IMPORT_IN_UNIT');
      expect(configIssue).toBeDefined();
    });

    it('flags unseeded randomness', () => {
      const code = `
describe('Combat', () => {
  it('applies random damage', () => {
    const damage = Math.random() * 100;
    expect(damage).toBeGreaterThan(0);
  });
});
      `;

      const result = analyzeTestFile(code, 'unit');
      const unseededIssue = result.issues.find((i) => i.code === 'UNSEEDED_RNG');
      expect(unseededIssue).toBeDefined();
      expect(unseededIssue?.severity).toBe('error');
    });

    it('validates contract test with live config', () => {
      const code = `
import { ENEMIES } from '@dungeon/content';

describe('EnemyContent', () => {
  it('all enemies have valid tier', () => {
    Object.values(ENEMIES).forEach((enemy) => {
      expect(enemy.tier).toBeGreaterThan(0);
    });
  });
});
      `;

      const result = analyzeTestFile(code, 'contract');
      expect(result.validated).toBe(true);
      expect(result.issues.filter((i) => i.severity === 'error').length).toBe(0);
    });

    it('recommends GameState for integration tests', () => {
      const code = `
describe('GameFlow', () => {
  it('player can move', () => {
    const player = new PlayerBuilder().build();
    // No GameState usage
  });
});
      `;

      const result = analyzeTestFile(code, 'integration');
      expect(result.suggestions.some((s) => s.includes('GameState'))).toBe(true);
    });

    it('catches exact value assertions in balance tests', () => {
      const code = `
describe('Balance', () => {
  it('player has correct health', () => {
    expect(player.stats.maxHealth).toBe(100);
  });
});
      `;

      const result = analyzeTestFile(code, 'balance');
      const exactValueIssue = result.issues.find((i) => i.code === 'BALANCE_TEST_EXACT_VALUE');
      expect(exactValueIssue).toBeDefined();
      expect(exactValueIssue?.severity).toBe('warning');
    });

    it('provides confidence score', () => {
      const code = `it('test', () => { expect(true).toBe(true); });`;
      const result = analyzeTestFile(code, 'unit');
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });
});

describe('test-builder-generator skill', () => {
  describe('generateBuilder', () => {
    it('generates PlayerBuilder', () => {
      const code = generateBuilder('Player');
      expect(code).toContain('export class PlayerBuilder');
      expect(code).toContain('withStats');
      expect(code).toContain('withEquipment');
      expect(code).toContain('build()');
      expect(code).toContain('static default()');
    });

    it('generates EnemyBuilder', () => {
      const code = generateBuilder('Enemy');
      expect(code).toContain('export class EnemyBuilder');
      expect(code).toContain('withPosition');
      expect(code).toContain('build()');
    });

    it('generated builder includes imports', () => {
      const code = generateBuilder('Player');
      expect(code).toContain('import');
      expect(code).toContain('@dungeon/contracts');
    });

    it('throws on unknown type', () => {
      expect(() => generateBuilder('UnknownType')).toThrow();
    });

    it('lists all available builders', () => {
      const builders = listAvailableBuilders();
      expect(builders).toContain('Player');
      expect(builders).toContain('Enemy');
      expect(builders).toContain('Item');
      expect(builders).toContain('GameState');
      expect(builders).toContain('SeededRng');
    });
  });

  describe('builder output patterns', () => {
    it('generated code is valid TypeScript syntax', () => {
      const code = generateBuilder('Player');
      // Basic syntax checks
      expect(code).toMatch(/export class \w+Builder/);
      expect(code).toMatch(/build\(\): \w+/);
      expect(code).toMatch(/static default\(\)/);
      expect(code).toMatch(/return this;/);
    });

    it('builder has fluent API (returns this)', () => {
      const code = generateBuilder('Enemy');
      expect(code).toMatch(/return this;/);
      // Should have multiple setter methods
      const returnThisMatches = code.match(/return this;/g);
      expect(returnThisMatches?.length).toBeGreaterThanOrEqual(1);
    });

    it('builder includes default() factory method', () => {
      const code = generateBuilder('Item');
      expect(code).toContain('static default()');
      expect(code).toContain('new ItemBuilder().build()');
    });
  });
});

describe('skill integration', () => {
  it('advisor validates generated builder usage', () => {
    const generatedBuilder = generateBuilder('Player');
    const testCode = `
import { PlayerBuilder } from './builders.js';
${generatedBuilder}

describe('Player', () => {
  it('uses builder', () => {
    const player = new PlayerBuilder().withStats({ health: 50 }).build();
    expect(player.stats.health).toBe(50);
  });
});
    `;

    const analysis = analyzeTestFile(testCode, 'unit');
    // Should recognize correct builder usage
    expect(analysis.suggestions.length).toBeLessThan(3); // No major issues
  });
});
