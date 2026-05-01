/**
 * audit-tests.ts
 * Automated test audit script to classify all tests by layer and identify anti-patterns.
 * Run with: pnpm exec tsx scripts/audit-tests.ts > tests/AUDIT.md
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  analyzeTestFile,
  type Issue,
} from '../packages/game-core/src/testing/test-layer-advisor.js';
import {
  getDefaultWorkspaceTestRunStatus,
  guessTestLayerFromPath,
  isRecognizedTestFilePath,
  normalizeTestPath,
  TEST_LAYER_LABELS,
  type TestLayer,
} from '../tests/test-file-patterns.js';

interface AuditResult {
  filePath: string;
  proposedLayer: TestLayer;
  includedInDefaultRun: boolean;
  defaultRunReason: string;
  issues: number;
  warnings: number;
  isValid: boolean;
  antiPatterns: string[];
}

const IGNORED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  'coverage',
  'playwright-report',
  'test-results',
  'balance-results',
]);

export function guessLayerFromPath(filePath: string): TestLayer {
  return guessTestLayerFromPath(filePath) ?? 'unit';
}

function extractAntiPatterns(issues: Issue[]): string[] {
  const patterns = new Set<string>();
  issues.forEach((issue) => {
    if (issue.code) patterns.add(issue.code);
  });
  return Array.from(patterns);
}

export function findAllTestFiles(dir: string): string[] {
  const repoRoot = path.resolve(dir);
  const files: string[] = [];

  function walk(current: string): void {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      const relativePath = normalizeTestPath(path.relative(repoRoot, fullPath));

      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name)) continue;
        walk(fullPath);
      } else if (isRecognizedTestFilePath(relativePath)) {
        files.push(relativePath);
      }
    }
  }

  walk(repoRoot);
  return files.sort();
}

export function auditAllTests(dir = '.'): AuditResult[] {
  const repoRoot = path.resolve(dir);
  const testFiles = findAllTestFiles(repoRoot);

  return testFiles.map((filePath) => {
    const content = fs.readFileSync(path.join(repoRoot, filePath), 'utf-8');
    const proposedLayer = guessLayerFromPath(filePath);
    const analysis = analyzeTestFile(content, proposedLayer);
    const defaultRunStatus = getDefaultWorkspaceTestRunStatus(filePath);

    return {
      filePath,
      proposedLayer,
      includedInDefaultRun: defaultRunStatus.included,
      defaultRunReason: defaultRunStatus.reason,
      issues: analysis.issues.filter((issue) => issue.severity === 'error').length,
      warnings: analysis.issues.filter((issue) => issue.severity === 'warning').length,
      isValid: analysis.validated,
      antiPatterns: extractAntiPatterns(analysis.issues),
    };
  });
}

export function generateReport(results: AuditResult[]): string {
  const lines: string[] = [];

  // Header
  lines.push('# Test Audit Report');
  lines.push('');
  lines.push('Auto-generated test analysis using `test-layer-advisor` skill.');
  lines.push('');

  // Summary
  const byLayer: Record<TestLayer, AuditResult[]> = {
    unit: [],
    property: [],
    contract: [],
    integration: [],
    balance: [],
    e2e: [],
  };

  results.forEach((result) => {
    byLayer[result.proposedLayer].push(result);
  });

  const validCount = results.filter((result) => result.isValid).length;
  const invalidCount = results.filter((result) => !result.isValid).length;
  const includedInDefaultRunCount = results.filter((result) => result.includedInDefaultRun).length;
  const totalIssues = results.reduce((sum, result) => sum + result.issues, 0);
  const totalWarnings = results.reduce((sum, result) => sum + result.warnings, 0);

  lines.push('## Summary');
  lines.push(`- **Total Test Files:** ${results.length}`);
  lines.push(`- **Valid (no errors):** ${validCount}`);
  lines.push(`- **Invalid (has errors):** ${invalidCount}`);
  lines.push(`- **Included in default workspace Vitest run:** ${includedInDefaultRunCount}`);
  lines.push(`- **Excluded from default workspace Vitest run:** ${results.length - includedInDefaultRunCount}`);
  lines.push(`- **Total Issues:** ${totalIssues}`);
  lines.push(`- **Total Warnings:** ${totalWarnings}`);
  lines.push('');

  // By layer
  lines.push('## Distribution by Layer');
  lines.push('');
  (Object.keys(byLayer) as TestLayer[]).forEach((layer) => {
    const tests = byLayer[layer];
    if (tests.length > 0) {
      const valid = tests.filter((test) => test.isValid).length;
      const includedInDefaultRun = tests.filter((test) => test.includedInDefaultRun).length;
      lines.push(`### ${TEST_LAYER_LABELS[layer]} Tests (${tests.length})`);
      lines.push(`- Valid: ${valid}/${tests.length}`);
      lines.push(`- Default workspace run: ${includedInDefaultRun}/${tests.length}`);
      lines.push(`- Issues: ${tests.reduce((sum, test) => sum + test.issues, 0)}`);
      lines.push(`- Warnings: ${tests.reduce((sum, test) => sum + test.warnings, 0)}`);
      lines.push('');
    }
  });

  // Files with errors
  const errorFiles = results.filter((result) => result.issues > 0);
  if (errorFiles.length > 0) {
    lines.push('## Files with Errors (High Priority)');
    lines.push('');
    errorFiles.slice(0, 10).forEach((result) => {
      lines.push(`- **${result.filePath}** (${result.antiPatterns.join(', ')})`);
    });
    if (errorFiles.length > 10) {
      lines.push(`- ... and ${errorFiles.length - 10} more files with errors`);
    }
    lines.push('');
  }

  const excludedFromDefaultRun = results.filter((result) => !result.includedInDefaultRun);
  if (excludedFromDefaultRun.length > 0) {
    lines.push('## Recognized but Excluded from Default Workspace Run');
    lines.push('');
    excludedFromDefaultRun
      .sort((a, b) => a.filePath.localeCompare(b.filePath))
      .forEach((result) => {
        lines.push(`- **${result.filePath}** — ${result.defaultRunReason}`);
      });
    lines.push('');
  }

  // Anti-pattern frequency
  const antiPatternCount: Record<string, number> = {};
  results.forEach((result) => {
    result.antiPatterns.forEach((antiPattern) => {
      antiPatternCount[antiPattern] = (antiPatternCount[antiPattern] ?? 0) + 1;
    });
  });

  if (Object.keys(antiPatternCount).length > 0) {
    lines.push('## Anti-Pattern Frequency');
    lines.push('');
    Object.entries(antiPatternCount)
      .sort((a, b) => b[1] - a[1])
      .forEach(([pattern, count]) => {
        lines.push(`- **${pattern}:** ${count} files`);
      });
    lines.push('');
  }

  // Phase 1 recommendations
  lines.push('## Phase 1 Recommendations');
  lines.push('');
  lines.push('1. Focus on high-priority error files first');
  lines.push('2. Most common anti-patterns to address:');
  Object.entries(antiPatternCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([pattern, count]) => {
      lines.push(`   - ${pattern} (${count} occurrences)`);
    });
  lines.push('');

  return lines.join('\n');
}

async function main(): Promise<void> {
  const results = auditAllTests(process.cwd());
  console.error(`Found ${results.length} test files. Analyzing...`);
  console.log(generateReport(results));
}

const isMain = process.argv[1] !== undefined
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
