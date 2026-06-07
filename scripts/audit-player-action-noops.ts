/**
 * Audit script to find potential silent no-op returns in player action paths.
 *
 * Scans game-core source files for patterns like `return { state, events: [], runEnded: false }`
 * and reports them for review.
 *
 * Some patterns are protected in this MVP (marked as failures).
 * Others are reported as informational findings for future triage.
 */

import { readFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';

interface Finding {
  file: string;
  line: number;
  snippet: string;
  protected: boolean;
}

const findings: Finding[] = [];
const protectedPaths = [
  'packages/game-core/src/engine/handlers/inventory-handlers.ts',
];

const REPO_ROOT = process.cwd();

function scanDirectory(dir: string) {
  const items = readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = join(dir, item.name);
    if (item.isDirectory()) {
      if (!item.name.startsWith('.') && item.name !== 'node_modules' && item.name !== 'dist') {
        scanDirectory(fullPath);
      }
    } else if (item.isFile() && (item.name.endsWith('.ts') || item.name.endsWith('.js'))) {
      if (item.name.endsWith('.test.ts') || item.name.endsWith('.test.js')) {
        continue;
      }
      scanFile(fullPath);
    }
  }
}

function scanFile(filePath: string) {
  if (!filePath.includes('packages/game-core/src')) {
    return;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line && line.includes('return') && line.includes('events:') && line.includes('[]')) {
        const relPath = relative(REPO_ROOT, filePath);
        const isProtected = protectedPaths.includes(relPath);
        findings.push({
          file: relPath,
          line: i + 1,
          snippet: line.trim(),
          protected: isProtected,
        });
      }
    }
  } catch {
  }
}

console.log('Auditing player action paths for silent no-op returns...\n');

scanDirectory(join(REPO_ROOT, 'packages/game-core/src'));

const protectedFindings = findings.filter((f) => f.protected);
const otherFindings = findings.filter((f) => !f.protected);

if (protectedFindings.length > 0) {
  console.log('PROTECTED PATHS (MVP scope):');
  console.log(`Found ${protectedFindings.length} empty-event returns that should be fixed:\n`);
  for (const finding of protectedFindings) {
    console.log(`  ${finding.file}:${finding.line}`);
    console.log(`    ${finding.snippet}`);
  }
  console.log();
}

if (otherFindings.length > 0) {
  console.log('OTHER FINDINGS (follow-up candidates):');
  console.log(`Found ${otherFindings.length} additional empty-event returns for triage:\n`);
  for (const finding of otherFindings) {
    console.log(`  ${finding.file}:${finding.line}`);
    console.log(`    ${finding.snippet}`);
  }
  console.log();
}

if (protectedFindings.length === 0) {
  console.log('✓ All protected paths have been fixed!\n');
  process.exit(0);
} else {
  console.log(`\n✗ ${protectedFindings.length} protected path(s) still have silent returns.`);
  process.exit(1);
}
