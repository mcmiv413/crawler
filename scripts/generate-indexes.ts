import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface ContentTypeConfig {
  /** Source directory relative to packages/content/src */
  sourceDir: string;
  /** Output index.ts path relative to packages/content/src */
  indexPath: string;
  /** Name of the exported array/map (e.g., ENEMIES, ENCHANTMENTS) */
  exportName: string;
  /** Type name for items */
  itemType: string;
  /** Where to import the type from ('contracts', 'local', or a specific path like './types.js') */
  typeImport?: 'contracts' | 'local' | string;
  /** 'array' or 'map' */
  exportType: 'array' | 'map';
  /** If map, the key field name (e.g., 'templateId', 'id') */
  keyField?: string;
  /** Derived indexes to generate (e.g., { name: 'ENEMIES_BY_BIOME', generator: 'buildByBiomeMap' }) */
  derivedIndexes?: Array<{
    name: string;
    generator: string;
  }>;
}

const configs: ContentTypeConfig[] = [
  {
    sourceDir: 'enemies',
    indexPath: 'enemies/index.ts',
    exportName: 'ENEMY_TEMPLATES',
    itemType: 'EnemyTemplate',
    exportType: 'map',
    keyField: 'templateId',
    derivedIndexes: [
      { name: 'ENEMIES_BY_BIOME', generator: 'buildByBiomeMap' },
      { name: 'ENEMIES_BY_FACTION', generator: 'buildByFactionMap' },
    ],
  },
  {
    sourceDir: 'biomes',
    indexPath: 'biomes/index.ts',
    exportName: 'BIOME_DEFINITIONS',
    itemType: 'BiomeDefinition',
    exportType: 'map',
    keyField: 'id',
  },
  {
    sourceDir: 'objects',
    indexPath: 'objects/index.ts',
    exportName: 'OBJECT_TEMPLATES',
    itemType: 'ObjectTemplate',
    exportType: 'map',
    keyField: 'templateId',
  },
  {
    sourceDir: 'archetypes',
    indexPath: 'archetypes/index.ts',
    exportName: 'ARCHETYPES',
    itemType: 'ArchetypeDefinition',
    exportType: 'map',
    keyField: 'id',
  },
  {
    sourceDir: 'ambient-profiles',
    indexPath: 'ambient-profiles/index.ts',
    exportName: 'AMBIENT_PROFILES',
    itemType: 'AmbientBehaviorProfile',
    exportType: 'map',
    keyField: 'id',
  },
  {
    sourceDir: 'enchantments',
    indexPath: 'enchantments/index.ts',
    exportName: 'ENCHANTMENTS',
    itemType: 'EnchantmentDefinition',
    exportType: 'array',
  },
  {
    sourceDir: 'statuses',
    indexPath: 'statuses/index.ts',
    exportName: 'STATUS_DEFINITIONS',
    itemType: 'StatusDefinition',
    typeImport: 'local',
    exportType: 'map',
    keyField: 'id',
  },
  {
    sourceDir: 'factions',
    indexPath: 'factions/index.ts',
    exportName: 'FACTION_DEFINITIONS',
    itemType: 'FactionDefinition',
    typeImport: 'local',
    exportType: 'array',
  },
  {
    sourceDir: 'quests',
    indexPath: 'quests/index.ts',
    exportName: 'QUEST_TEMPLATES',
    itemType: 'QuestTemplate',
    typeImport: 'local',
    exportType: 'array',
  },
  // Items sub-categories
  {
    sourceDir: 'items/weapons',
    indexPath: 'items/weapons/index.ts',
    exportName: 'WEAPONS',
    itemType: 'WeaponTemplate',
    exportType: 'array',
  },
  {
    sourceDir: 'items/armor',
    indexPath: 'items/armor/index.ts',
    exportName: 'ARMOR',
    itemType: 'ArmorTemplate',
    exportType: 'array',
  },
  {
    sourceDir: 'items/consumables',
    indexPath: 'items/consumables/index.ts',
    exportName: 'CONSUMABLES',
    itemType: 'ConsumableTemplate',
    exportType: 'array',
  },
  {
    sourceDir: 'items/traps',
    indexPath: 'items/traps/index.ts',
    exportName: 'TRAPS',
    itemType: 'TrapItemTemplate',
    exportType: 'array',
  },
  // Abilities
  {
    sourceDir: 'abilities',
    indexPath: 'abilities/index.ts',
    exportName: 'ABILITY_DEFINITIONS',
    itemType: 'AbilityDefinition',
    typeImport: 'local',
    exportType: 'map',
    keyField: 'id',
  },
];

function getExportName(filename: string): string {
  // Convert kebab-case to camelCase: 'skeleton-warrior' -> 'skeletonWarrior'
  return filename
    .split('-')
    .map((part, idx) =>
      idx === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join('');
}

function scanDirectory(dirPath: string): string[] {
  try {
    const files = readdirSync(dirPath, { withFileTypes: true });
    return files
      .filter(
        f =>
          f.isFile() &&
          f.name.endsWith('.ts') &&
          !f.name.startsWith('index') &&
          !f.name.startsWith('types') &&
          !f.name.startsWith('definitions') &&
          !f.name.startsWith('mastery') &&
          !f.name.startsWith('utils') &&
          !f.name.endsWith('.test.ts')
      )
      .map(f => f.name.replace(/\.ts$/, ''));
  } catch {
    return [];
  }
}

function generateIndex(config: ContentTypeConfig): string {
  const contentPath = join(process.cwd(), 'packages/content/src', config.sourceDir);
  const files = scanDirectory(contentPath);

  if (files.length === 0) {
    console.warn(`⚠️  No definition files found in ${config.sourceDir}`);
    return '';
  }

  const importLines = files
    .map(file => {
      const exportName = getExportName(file);
      return `import { ${exportName} } from './${file}.js';`;
    })
    .join('\n');

  const itemsArrayName =
    config.exportType === 'map' ? 'items' : config.exportName.toLowerCase();

  let contentDefinition = '';
  if (config.exportType === 'map') {
    contentDefinition = `
const ${itemsArrayName}: [string, ${config.itemType}][] = [
${files.map(file => {
  const exportName = getExportName(file);
  const keyField = config.keyField || 'id';
  return `  [${exportName}.${keyField}, ${exportName}],`;
}).join('\n')}
];

export const ${config.exportName}: ReadonlyMap<string, ${config.itemType}> = new Map(${itemsArrayName});`;
  } else {
    contentDefinition = `
export const ${config.exportName}: readonly ${config.itemType}[] = [
${files.map(file => `  ${getExportName(file)},`).join('\n')}
];`;
  }

  let derivedIndexesCode = '';
  if (config.derivedIndexes && config.derivedIndexes.length > 0) {
    config.derivedIndexes.forEach(di => {
      derivedIndexesCode += `\n/** Precomputed map via ${di.generator} */
export const ${di.name} = ${di.generator}(${config.exportName});`;
    });
  }

  const reExports = files.map(file => getExportName(file)).join(', ');

  const typeImport = config.typeImport || 'contracts';
  let typeImportLine = '';
  if (typeImport === 'contracts') {
    typeImportLine = `import type { ${config.itemType} } from '@dungeon/contracts';`;
  } else if (typeImport === 'local') {
    typeImportLine = `import type { ${config.itemType} } from './types.js';`;
  } else {
    typeImportLine = `import type { ${config.itemType} } from '${typeImport}';`;
  }

  const lines = [
    '// Auto-generated — do not edit manually',
    typeImportLine,
    importLines,
  ];

  if (config.derivedIndexes && config.derivedIndexes.length > 0) {
    const imports = config.derivedIndexes
      .map(di => di.generator)
      .filter((v, i, a) => a.indexOf(v) === i);
    if (imports.length > 0) {
      lines.push(`import { ${imports.join(', ')} } from '../utils/biome-map.js';`);
    }
  }

  lines.push(contentDefinition);

  if (derivedIndexesCode) {
    lines.push(derivedIndexesCode);
  }

  lines.push(`\nexport {\n  ${reExports},\n};`);
  lines.push('\n// Add custom utilities below this line ↓');

  return lines.filter(l => l.trim()).join('\n') + '\n';
}

function main() {
  let generatedCount = 0;
  const errors: string[] = [];

  for (const config of configs) {
    try {
      const content = generateIndex(config);
      if (!content) continue;

      const indexPath = join(
        process.cwd(),
        'packages/content/src',
        config.indexPath
      );
      writeFileSync(indexPath, content);
      console.log(`✅ Generated ${config.indexPath}`);
      generatedCount++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`❌ Failed to generate ${config.indexPath}: ${msg}`);
    }
  }

  console.log(`\n✨ Generated ${generatedCount} index files`);
  if (errors.length > 0) {
    console.error('\nErrors:');
    errors.forEach(e => console.error(e));
    process.exit(1);
  }
}

main();
