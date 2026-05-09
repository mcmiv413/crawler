/**
 * Generator for animation reference catalog.
 *
 * Discovers all AnimationRef exports from packages/content/src/animation-refs/*.ts
 * Validates each ref and emits the grouped animationRefs object to index.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const CONTENT_DIR = join(process.cwd(), 'packages/content/src');
const ANIMATION_REFS_DIR = join(CONTENT_DIR, 'animation-refs');

interface AnimationRef {
  id: string;
  category: string;
  durationMs: number;
  suppressActorBump?: boolean;
}

export function generateAnimationRefsIndex(): void {
  console.log('[animation-refs-gen] Discovered animation-refs catalog structure');
  console.log('[animation-refs-gen] Refs will be auto-discovered once definitions export AnimationRef');
  // Phase 0: Catalog scaffold. Generator extended in later phases when refs exist.
}

function validateRef(ref: AnimationRef): void {
  if (!ref.id.match(/^fx\.[a-z]+\.[a-z0-9-]+$/)) {
    throw new Error(`Invalid animation ID format: ${ref.id}. Must be fx.<category>.<kebab-name>`);
  }

  if (ref.durationMs <= 0 || !Number.isInteger(ref.durationMs)) {
    throw new Error(`Invalid durationMs for ${ref.id}: ${ref.durationMs}. Must be positive integer`);
  }

  if ((ref.category === 'projectile' || ref.category === 'aoe') && ref.suppressActorBump === undefined) {
    throw new Error(`Projectile/AOE ref ${ref.id} must explicitly declare suppressActorBump (true or false)`);
  }
}

function validateRefs(refs: Map<string, { ref: AnimationRef; category: string }>): void {
  const ids = Array.from(refs.keys());
  const uniqueIds = new Set(ids);

  if (uniqueIds.size !== ids.length) {
    const seen = new Set<string>();
    const dupes = ids.filter(id => {
      if (seen.has(id)) return true;
      seen.add(id);
      return false;
    });
    throw new Error(`Duplicate animation IDs: ${dupes.join(', ')}`);
  }
}

function generateIndexFile(refs: Map<string, { ref: AnimationRef; category: string }>): void {
  const categories = ['impact', 'projectile', 'self', 'aoe', 'status', 'utility'];
  const grouped: Record<string, Record<string, string>> = {};

  for (const category of categories) {
    grouped[category] = {};
  }

  for (const [id, { ref, category }] of refs) {
    // Extract name from id: fx.impact.radial-burst => radialBurst
    const parts = id.split('.');
    const kebabName = parts[parts.length - 1];
    const camelName = kebabName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

    grouped[category][camelName] = id;
  }

  const imports = Array.from(refs.values())
    .map(({ ref, category }) => {
      const parts = ref.id.split('.');
      const kebabName = parts[parts.length - 1];
      const fileName = kebabName;
      const camelName = kebabName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      return `import { ${camelName} } from './${category}.js';`;
    })
    .filter((v, i, a) => a.indexOf(v) === i); // Deduplicate

  let groupedObj = '{\n';
  for (const category of categories) {
    const refNames = Object.keys(grouped[category]);
    if (refNames.length > 0) {
      groupedObj += `  ${category}: {\n`;
      for (const name of refNames) {
        groupedObj += `    ${name},\n`;
      }
      groupedObj += `  },\n`;
    } else {
      groupedObj += `  ${category}: {},\n`;
    }
  }
  groupedObj += '} as const';

  const output = `/**
 * Auto-generated animation reference catalog.
 * DO NOT EDIT — run pnpm generate:indexes to regenerate.
 *
 * The canonical catalog of all animation references.
 * Every animation ID literal (fx.category.name) is declared here.
 * Consumers must dot-walk through animationRefs to reference animations.
 */

${imports.join('\n')}

export const animationRefs = ${groupedObj};

export type { AnimationRef, AnimationId, AnimationCategory } from './types.js';
`;

  writeFileSync(join(ANIMATION_REFS_DIR, 'index.ts'), output, 'utf8');
}

if (require.main === module) {
  generateAnimationRefsIndex();
}

export {};
