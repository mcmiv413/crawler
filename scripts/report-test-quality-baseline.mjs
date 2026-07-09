#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { isCliMain, parseArgs } from './guardrails/common.mjs';
import { getTestQualityReportAll } from './check-test-quality.mjs';

export function groupByCategory(rows) {
  const categoryRows = rows.flatMap((row) =>
    row.failures.map((failure) => ({
      category: failure.title,
      relativePath: row.relativePath,
    })),
  );
  const categories = [...new Set(categoryRows.map((row) => row.category))];

  return Object.fromEntries(categories.map((category) => [
    category,
    [
      ...new Set(
        categoryRows
          .filter((row) => row.category === category)
          .map((row) => row.relativePath),
      ),
    ].sort(),
  ]));
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

if (isCliMain(import.meta.url)) {
  run();
}
