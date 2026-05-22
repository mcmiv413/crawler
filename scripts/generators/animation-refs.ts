/**
 * Generator for animation reference catalog.
 *
 * Discovers all AnimationRef exports from packages/content/src/animation-refs/*.ts
 * Validates each ref and emits the grouped animationRefs object to index.ts
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const CATEGORY_ORDER = ['impact', 'projectile', 'self', 'aoe', 'status', 'utility'] as const;

interface AnimationRef {
  id: string;
  category: string;
  durationMs: number;
  impactFrameMs: number;
  recoveryMs: number;
  suppressActorBump?: boolean;
}

function getAnimationRefsDir(rootDir: string): string {
  return join(rootDir, 'packages/content/src/animation-refs');
}

export function generateAnimationRefsIndex(rootDir = process.cwd()): void {
  const refs = scanRefs(rootDir);
  validateRefs(refs);
  generateIndexFile(refs, rootDir);
  console.log(`✅ Generated animation-refs/index.ts (${refs.size} refs)`);
}

function validateRef(ref: AnimationRef): void {
  if (!ref.id.match(/^fx\.[a-z]+\.[a-z0-9-]+$/)) {
    throw new Error(`Invalid animation ID format: ${ref.id}. Must be fx.<category>.<kebab-name>`);
  }

  if (ref.durationMs <= 0 || !Number.isInteger(ref.durationMs)) {
    throw new Error(`Invalid durationMs for ${ref.id}: ${ref.durationMs}. Must be positive integer`);
  }

  if (!Number.isInteger(ref.impactFrameMs)) {
    throw new Error(`Invalid impactFrameMs for ${ref.id}: ${ref.impactFrameMs}. Must be integer`);
  }

  if (!Number.isInteger(ref.recoveryMs)) {
    throw new Error(`Invalid recoveryMs for ${ref.id}: ${ref.recoveryMs}. Must be integer`);
  }

  if ((ref.category === 'projectile' || ref.category === 'aoe') && ref.suppressActorBump === undefined) {
    throw new Error(`Projectile/AOE ref ${ref.id} must explicitly declare suppressActorBump (true or false)`);
  }
}

function validateRefs(refs: Map<string, { ref: AnimationRef; category: string; exportName: string }>): void {
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

function scanRefs(rootDir: string): Map<string, { ref: AnimationRef; category: string; exportName: string }> {
  const refs = new Map<string, { ref: AnimationRef; category: string; exportName: string }>();
  const animationRefsDir = getAnimationRefsDir(rootDir);

  for (const entry of readdirSync(animationRefsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;
    if (entry.name === 'index.ts' || entry.name === 'types.ts' || entry.name.endsWith('.test.ts')) continue;

    const category = entry.name.replace(/\.ts$/, '');
    const source = readFileSync(join(animationRefsDir, entry.name), 'utf8');
    const exportRegex = /export const (\w+)(?:\s*:\s*AnimationRef)?\s*=\s*([\s\S]*?)(?:\} as const satisfies AnimationRef;|\};)/g;

    for (const match of source.matchAll(exportRegex)) {
      const exportName = match[1]!;
      const body = match[2]!;
      const id = body.match(/id:\s*'([^']+)'/)?.[1];
      const declaredCategory = body.match(/category:\s*'([^']+)'/)?.[1];
      const durationMs = Number(body.match(/durationMs:\s*(\d+)/)?.[1]);
      const impactFrameMs = Number(body.match(/impactFrameMs:\s*(\d+)/)?.[1]);
      const recoveryMs = Number(body.match(/recoveryMs:\s*(\d+)/)?.[1]);
      const suppressActorBumpMatch = body.match(/suppressActorBump:\s*(true|false)/)?.[1];

      if (
        id === undefined
        || declaredCategory === undefined
        || !Number.isInteger(durationMs)
        || !Number.isInteger(impactFrameMs)
        || !Number.isInteger(recoveryMs)
      ) {
        throw new Error(`Could not parse AnimationRef export ${exportName} in ${entry.name}`);
      }

      const ref: AnimationRef = {
        id,
        category: declaredCategory,
        durationMs,
        impactFrameMs,
        recoveryMs,
        ...(suppressActorBumpMatch !== undefined
          ? { suppressActorBump: suppressActorBumpMatch === 'true' }
          : {}),
      };
      validateRef(ref);
      if (declaredCategory !== category) {
        throw new Error(`AnimationRef ${exportName} declares category ${declaredCategory} in ${entry.name}`);
      }
      if (refs.has(id)) {
        throw new Error(`Duplicate animation ID: ${id}`);
      }
      refs.set(id, { ref, category, exportName });
    }
  }

  return refs;
}

function generateIndexFile(
  refs: Map<string, { ref: AnimationRef; category: string; exportName: string }>,
  rootDir: string,
): void {
  const exportNameCounts = Array.from(refs.values()).reduce<Record<string, number>>((counts, info) => {
    counts[info.exportName] = (counts[info.exportName] ?? 0) + 1;
    return counts;
  }, {});

  const localNameFor = (info: { exportName: string; category: string }): string => {
    if ((exportNameCounts[info.exportName] ?? 0) <= 1) return info.exportName;
    return `${info.exportName}${info.category.charAt(0).toUpperCase()}${info.category.slice(1)}`;
  };

  const imports = CATEGORY_ORDER
    .map(category => {
      const names = Array.from(refs.values())
        .filter(info => info.category === category)
        .map(info => {
          const localName = localNameFor(info);
          return localName === info.exportName ? info.exportName : `${info.exportName} as ${localName}`;
        });
      return names.length > 0 ? `import { ${names.join(', ')} } from './${category}.js';` : '';
    })
    .filter(line => line.length > 0);

  let groupedObj = '{\n';
  for (const category of CATEGORY_ORDER) {
    const refNames = Array.from(refs.values())
      .filter(info => info.category === category)
      .map(info => info.exportName);
    if (refNames.length > 0) {
      groupedObj += `  ${category}: {\n`;
      for (const info of Array.from(refs.values()).filter(candidate => candidate.category === category)) {
        const localName = localNameFor(info);
        groupedObj += localName === info.exportName
          ? `    ${info.exportName},\n`
          : `    ${info.exportName}: ${localName},\n`;
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

/** Flat O(1) lookup map of all animation refs by ID. Used by the presenter for fast ref resolution. */
export const ANIMATION_REF_BY_ID = new Map(
  [
${CATEGORY_ORDER.map(category => `    ...Object.values(animationRefs.${category}),`).join('\n')}
  ].map(ref => [ref.id, ref] as const)
);

export type { AnimationRef, AnimationId, AnimationCategory } from './types.js';
`;

  writeFileSync(join(getAnimationRefsDir(rootDir), 'index.ts'), output, 'utf8');
}

if (existsSync(fileURLToPath(import.meta.url)) && process.argv[1] === fileURLToPath(import.meta.url)) {
  generateAnimationRefsIndex();
}

export {};
