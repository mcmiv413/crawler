import { spawnSync } from 'node:child_process';
import {
  formatFailures,
  isCliMain,
  matchesAnyPrefix,
  normalizePath,
  parseArgs,
  resolveRoot,
  walkFiles,
} from './common.mjs';

const TEST_FILE_PATTERN = /(?:\.test\.|\.spec\.)/;

const DEFAULT_SCRATCH_ALLOWLIST = [
  '.codex',
  '.validate-logs',
  'tmp',
];

const DEFAULT_TOPOLOGY_EXCLUDED_PREFIXES = [
  'docs/skills',
  '.github/skills',
  '.claude/skills',
  '.agents/skills',
];

function runGit(rootDir, args, input) {
  const result = spawnSync('git', ['-C', rootDir, ...args], {
    input,
    encoding: 'utf8',
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function hasGitRepo(rootDir) {
  return runGit(rootDir, ['rev-parse', '--is-inside-work-tree']).status === 0;
}

function isTopologyCandidate(relativePath) {
  const normalized = normalizePath(relativePath);
  return TEST_FILE_PATTERN.test(normalized) || normalized.startsWith('tests/contracts/');
}

function splitOutputLines(output) {
  return output
    .split('\n')
    .map((line) => normalizePath(line.trim()))
    .filter(Boolean);
}

function getGitStatus(rootDir) {
  const result = runGit(rootDir, ['status', '--porcelain=v1', '--ignored=matching', '--untracked-files=all']);
  if (result.status !== 0) {
    throw new Error(result.stderr || 'git status failed');
  }
  const ignored = new Set();
  const untracked = new Set();

  for (const line of splitOutputLines(result.stdout)) {
    const status = line.slice(0, 2);
    const relativePath = normalizePath(line.slice(3));
    if (status === '!!') ignored.add(relativePath);
    if (status === '??') untracked.add(relativePath);
  }

  return { ignored, untracked };
}

function expectedRootLayer(relativePath) {
  if (relativePath.startsWith('tests/contracts/')) return 'contract';
  if (relativePath.startsWith('tests/integration/')) return 'integration';
  return null;
}

function isIncludedByExpectedRootRunner(relativePath, layer) {
  if (layer === 'contract') {
    return relativePath.endsWith('.contract.test.ts') || relativePath.endsWith('.contract.test.tsx');
  }
  if (layer === 'integration') {
    return relativePath.endsWith('.integration.test.ts') || relativePath.endsWith('.integration.test.tsx');
  }
  return true;
}

export function checkTestTopology(options = {}) {
  const rootDir = resolveRoot(options.rootDir);
  const scratchAllowlist = options.scratchAllowlist ?? DEFAULT_SCRATCH_ALLOWLIST;
  const excludedPrefixes = options.excludedPrefixes ?? DEFAULT_TOPOLOGY_EXCLUDED_PREFIXES;
  const failures = [];
  const files = walkFiles(rootDir)
    .filter(isTopologyCandidate)
    .filter((relativePath) => matchesAnyPrefix(relativePath, scratchAllowlist) === false)
    .filter((relativePath) => matchesAnyPrefix(relativePath, excludedPrefixes) === false);

  if (!hasGitRepo(rootDir)) {
    failures.push('test-topology: root is not a git worktree, so ignored/untracked test files cannot be proven');
    return failures;
  }

  const status = getGitStatus(rootDir);
  const candidateSet = new Set(files);
  const ignoredFiles = [...status.ignored].filter((relativePath) => candidateSet.has(relativePath));
  const untrackedFiles = [...status.untracked].filter((relativePath) => candidateSet.has(relativePath));

  for (const relativePath of ignoredFiles) {
    failures.push(
      `${relativePath}: test-like file is ignored by git; add a narrow .gitignore allowlist or move it to scratch space`,
    );
  }

  for (const relativePath of untrackedFiles) {
    failures.push(
      `${relativePath}: test-like file is untracked; add it to git or move local-only fixtures to an explicit scratch path`,
    );
  }

  for (const relativePath of files) {
    const layer = expectedRootLayer(relativePath);
    if (layer === null) continue;

    if (isIncludedByExpectedRootRunner(relativePath, layer) === false) {
      failures.push(
        `${relativePath}: ${layer} test is not named for the root Vitest include patterns`,
      );
    }
  }

  return failures;
}

if (isCliMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const failures = checkTestTopology({ rootDir: args.root });
  if (failures.length > 0) {
    console.error(formatFailures('Test topology guardrail', failures));
    process.exit(1);
  }
  console.log('Test topology guardrail passed.');
}
