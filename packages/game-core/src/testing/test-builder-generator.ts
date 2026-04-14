/**
 * test-builder-generator.ts
 *
 * Generates builder classes for domain objects following project patterns.
 * This is a working implementation that can be invoked to generate builders.
 *
 * Usage:
 *   const code = generateBuilder('Player');
 *   console.log(code); // TypeScript code ready to use
 */

export interface BuilderSpec {
  typeName: string;
  properties: PropertySpec[];
  defaults: Record<string, unknown>;
  imports: string[];
}

export interface PropertySpec {
  name: string;
  type: string;
  optional: boolean;
}

/**
 * Generate a complete builder class for a domain type.
 */
export function generateBuilder(typeName: string): string {
  const spec = getBuildersSpec(typeName);
  if (spec === null) {
    throw new Error(`No builder spec for type: ${typeName}`);
  }

  return renderBuilder(spec);
}

/**
 * Get builder specification for a domain type.
 */
function getBuildersSpec(typeName: string): BuilderSpec | null {
  switch (typeName) {
    case 'Player':
      return {
        typeName: 'Player',
        properties: [
          { name: 'id', type: 'EntityId', optional: false },
          { name: 'name', type: 'string', optional: false },
          { name: 'stats', type: 'PlayerStats', optional: false },
          { name: 'equipment', type: 'PlayerEquipment', optional: false },
          { name: 'inventory', type: 'Inventory', optional: false },
          { name: 'abilities', type: 'Map<AbilityId, AbilityInstance>', optional: false },
          { name: 'statuses', type: 'StatusEffect[]', optional: false },
          { name: 'level', type: 'number', optional: false },
          { name: 'experience', type: 'number', optional: false },
        ],
        defaults: {
          id: "entityId('test_player')",
          name: 'Hero',
          stats: `{ maxHealth: 100, health: 100, attack: 10, defense: 5, accuracy: 80, evasion: 20, speed: 100 }`,
          equipment: `{ weapon: null, armor: [] }`,
          inventory: `{ items: [], gold: 0 }`,
          abilities: `new Map()`,
          statuses: `[]`,
          level: 1,
          experience: 0,
        },
        imports: [
          "import type { Player, PlayerStats, PlayerEquipment, Inventory } from '@dungeon/contracts';",
          "import { entityId } from '@dungeon/contracts';",
        ],
      };

    case 'Enemy':
      return {
        typeName: 'Enemy',
        properties: [
          { name: 'id', type: 'EntityId', optional: false },
          { name: 'templateId', type: 'string', optional: false },
          { name: 'name', type: 'string', optional: false },
          { name: 'stats', type: 'EnemyStats', optional: false },
          { name: 'position', type: 'Position', optional: false },
          { name: 'tier', type: 'number', optional: false },
          { name: 'isAlerted', type: 'boolean', optional: false },
        ],
        defaults: {
          id: "entityId('test_enemy')",
          templateId: 'goblin_skirmisher',
          name: 'Enemy',
          stats: `{ maxHealth: 30, health: 30, attack: 5, defense: 2, accuracy: 70, evasion: 10, speed: 100 }`,
          position: `{ x: 0, y: 0 }`,
          tier: 1,
          isAlerted: false,
        },
        imports: [
          "import type { EnemyInstance, EnemyStats } from '@dungeon/contracts';",
          "import { entityId } from '@dungeon/contracts';",
        ],
      };

    case 'Item':
      return {
        typeName: 'Item',
        properties: [
          { name: 'id', type: 'ItemId', optional: false },
          { name: 'name', type: 'string', optional: false },
          { name: 'type', type: 'ItemType', optional: false },
          { name: 'rarity', type: 'Rarity', optional: false },
          { name: 'value', type: 'number', optional: false },
        ],
        defaults: {
          id: "itemId('test_item')",
          name: 'Test Item',
          type: "'consumable'",
          rarity: "'common'",
          value: 10,
        },
        imports: ["import type { ItemInstance } from '@dungeon/contracts';", "import { itemId } from '@dungeon/contracts';"],
      };

    case 'GameState':
      return {
        typeName: 'GameState',
        properties: [
          { name: 'player', type: 'Player', optional: false },
          { name: 'phase', type: 'GamePhase', optional: false },
          { name: 'run', type: 'DungeonRun | null', optional: true },
          { name: 'events', type: 'DomainEvent[]', optional: false },
        ],
        defaults: {
          player: 'new PlayerBuilder().build()',
          phase: "'town'",
          run: 'null',
          events: `[]`,
        },
        imports: [
          "import type { GameState, GamePhase, DungeonRun } from '@dungeon/contracts';",
          "import { PlayerBuilder } from './character-builder';",
        ],
      };

    case 'SeededRng':
      return {
        typeName: 'SeededRng',
        properties: [
          { name: 'seed', type: 'number', optional: false },
          { name: 'state', type: 'number', optional: false },
        ],
        defaults: {
          seed: 42,
          state: 42,
        },
        imports: [],
      };

    default:
      return null;
  }
}

/**
 * Render builder class code.
 */
function renderBuilder(spec: BuilderSpec): string {
  const classNameBuilder = `${spec.typeName}Builder`;

  const importLines = spec.imports.length > 0 ? [...spec.imports, ''] : [];
  const classStart = [`export class ${classNameBuilder} {`, `  private data: Partial<${spec.typeName}> = {`];
  const defaultLines = Object.entries(spec.defaults).map(([key, value]) => `    ${key}: ${value},`);
  const classEnd = ['  };', ''];

  const setterLines = spec.properties
    .filter((prop) => prop.name !== 'id')
    .flatMap((prop) => {
      const methodName = toCamelCase(prop.name);
      return [
        `  with${capitalize(methodName)}(value: ${prop.type}): this {`,
        `    this.data.${prop.name} = value;`,
        `    return this;`,
        `  }`,
        '',
      ];
    });

  const buildDefaultLines = Object.entries(spec.defaults).map(([key]) => `      ${key}: this.data.${key},`);
  const buildLines = [
    `  build(): ${spec.typeName} {`,
    `    const defaults = {`,
    ...buildDefaultLines,
    '    };',
    `    return { ...defaults, ...this.data } as ${spec.typeName};`,
    '  }',
    '',
  ];

  const staticLines = [
    `  static default(): ${spec.typeName} {`,
    `    return new ${classNameBuilder}().build();`,
    '  }',
    '}',
  ];

  const allLines = [...importLines, ...classStart, ...defaultLines, ...classEnd, ...setterLines, ...buildLines, ...staticLines];
  return allLines.join('\n');
}

// ============================================================================
// String utilities
// ============================================================================

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function toCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
}

/**
 * List all available builders.
 */
export function listAvailableBuilders(): string[] {
  return ['Player', 'Enemy', 'Item', 'GameState', 'SeededRng'];
}
