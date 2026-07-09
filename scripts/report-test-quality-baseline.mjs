#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from './guardrails/common.mjs';
import { getTestQualityReportAll } from './check-test-quality.mjs';

function groupByCategory(rows) {
  const categories = {};

  for (const row of rows) {
    for (const failure of row.failures) {
      categories[failure.title] = [...(categories[failure.title] ?? []), row.relativePath].sort();
    }
  }

  return categories;
}

function run() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = resolve(typeof args.root === 'string' ? args.root : process.cwd());
  const outputPath = typeof args.output === 'string'
    ? args.output
    : '.validate-logs/test-quality-baseline.json';
  const baseline = getTestQualityReportAll(rootDir);

  const report = {
    command: 'pnpm run check:test-quality -- --report-all',
    checkedFiles: baseline.testPaths.length,
    violationFiles: baseline.failingRows.length,
    categories: groupByCategory(baseline.rows),
  };

  const absoluteOutputPath = join(rootDir, outputPath);
  mkdirSync(dirname(absoluteOutputPath), { recursive: true });
  writeFileSync(absoluteOutputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log([
    `Wrote ${outputPath}`,
    `Checked files: ${report.checkedFiles}`,
    `Files with violations: ${report.violationFiles}`,
    `Categories: ${Object.keys(report.categories).length}`,
  ].join('\n'));
}

run();
