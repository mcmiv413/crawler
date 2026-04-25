/**
/**
 * audit-tests.ts
 * Automated test audit script to classify all tests by layer and identify anti-patterns.
 * Run with: pnpm exec tsx scripts/audit-tests.ts > tests/AUDIT.md
 */

import * as fs from 'fs';
import * as path from 'path';
import { analyzeTestFile } from '../packages/game-core/src/testing/test-layer-advisor.js';

interface AuditResult {
  filePath: string;
  proposedLayer: string;
  issues: number;
  warnings: number;
  isValid: boolean;
  antiPatterns: string[];
}

function guessLayerFromPath(filePath: string): string {
  if (filePath.includes('tests/contracts')) return 'contract';
  if (filePath.includes('tests/integration')) return 'integration';
  if (filePath.includes('tests/balance')) return 'balance';
  if (filePath.includes('tests/smoke')) return 'smoke';
  if (filePath.includes('tests/e2e')) return 'smoke';
  if (filePath.includes('property')) return 'unit'; // *.property.test.ts
  return 'unit'; // Default to unit
}

function extractAntiPatterns(issues: any[]): string[] {
  const patterns = new Set<string>();
  issues.forEach((issue) => {
    if (issue.code) patterns.add(issue.code);
  });
  return Array.from(patterns);
}

function findAllTestFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(current: string) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

async function auditAllTests(): Promise<void> {
  const testFiles = findAllTestFiles('.');
  const results: AuditResult[] = [];

  console.error(`Found ${testFiles.length} test files. Analyzing...`);

  for (const filePath of testFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const proposedLayer = guessLayerFromPath(filePath);
      const analysis = analyzeTestFile(content, proposedLayer);

      const result: AuditResult = {
        filePath: filePath.replace(/^\.\//,  ''),
        proposedLayer,
        issues: analysis.issues.filter((i) => i.severity === 'error').length,
        warnings: analysis.issues.filter((i) => i.severity === 'warning').length,
        isValid: analysis.validated,
        antiPatterns: extractAntiPatterns(analysis.issues),
      };

      results.push(result);
    } catch (err: any) {
      console.error(`Error analyzing ${filePath}: ${err.message}`);
    }
  }

  // Generate report
  const report = generateReport(results);
  console.log(report);
}

function generateReport(results: AuditResult[]): string {
  const lines: string[] = [];

  // Header
  lines.push('# Test Audit Report');
  lines.push('');
  lines.push('Auto-generated test analysis using `test-layer-advisor` skill.');
  lines.push('');

  // Summary
  const byLayer: Record<string, AuditResult[]> = {
    unit: [],
    contract: [],
    integration: [],
    balance: [],
    smoke: [],
  };

  results.forEach((r) => {
    byLayer[r.proposedLayer as keyof typeof byLayer]?.push(r);
  });

  const validCount = results.filter((r) => r.isValid).length;
  const invalidCount = results.filter((r) => !r.isValid).length;
  const totalIssues = results.reduce((sum, r) => sum + r.issues, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings, 0);

  lines.push('## Summary');
  lines.push(`- **Total Test Files:** ${results.length}`);
  lines.push(`- **Valid (no errors):** ${validCount}`);
  lines.push(`- **Invalid (has errors):** ${invalidCount}`);
  lines.push(`- **Total Issues:** ${totalIssues}`);
  lines.push(`- **Total Warnings:** ${totalWarnings}`);
  lines.push('');

  // By layer
  lines.push('## Distribution by Layer');
  lines.push('');
  Object.entries(byLayer).forEach(([layer, tests]) => {
    if (tests.length > 0) {
      const valid = tests.filter((t) => t.isValid).length;
      lines.push(`### ${capitalize(layer)} Tests (${tests.length})`);
      lines.push(`- Valid: ${valid}/${tests.length}`);
      lines.push(`- Issues: ${tests.reduce((sum, t) => sum + t.issues, 0)}`);
      lines.push(`- Warnings: ${tests.reduce((sum, t) => sum + t.warnings, 0)}`);
      lines.push('');
    }
  });

  // Files with errors
  const errorsFiles = results.filter((r) => r.issues > 0);
  if (errorsFiles.length > 0) {
    lines.push('## Files with Errors (High Priority)');
    lines.push('');
    errorsFiles.slice(0, 10).forEach((r) => {
      lines.push(`- **${r.filePath}** (${r.antiPatterns.join(', ')})`);
    });
    if (errorsFiles.length > 10) {
      lines.push(`- ... and ${errorsFiles.length - 10} more files with errors`);
    }
    lines.push('');
  }

  // Anti-pattern frequency
  const antiPatternCount: Record<string, number> = {};
  results.forEach((r) => {
    r.antiPatterns.forEach((ap) => {
      antiPatternCount[ap] = (antiPatternCount[ap] ?? 0) + 1;
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

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

auditAllTests().catch(console.error);
