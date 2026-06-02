import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

export const CANONICAL_SKILL_ROOT = 'docs/skills';
export const TARGET_SKILL_ROOTS = ['.github/skills', '.claude/skills', '.agents/skills'];

function listFiles(rootDir) {
  const results = [];

  function walk(currentDir) {
    for (const entry of readdirSync(currentDir)) {
      const absolutePath = join(currentDir, entry);
      const relativePath = relative(rootDir, absolutePath);
      const stats = statSync(absolutePath);
      if (stats.isDirectory()) {
        walk(absolutePath);
        continue;
      }
      results.push(relativePath);
    }
  }

  if (existsSync(rootDir)) {
    walk(rootDir);
  }

  return results.sort();
}

export function resolveRepoRoot(argv = process.argv.slice(2)) {
  const rootFlagIndex = argv.indexOf('--root');
  if (rootFlagIndex === -1) {
    return resolve(process.cwd());
  }

  const providedRoot = argv[rootFlagIndex + 1];
  if (!providedRoot) {
    throw new Error('Missing value for --root.');
  }

  return resolve(providedRoot);
}

export function getCanonicalRoot(repoRoot) {
  return join(repoRoot, CANONICAL_SKILL_ROOT);
}

export function listCanonicalSkills(repoRoot) {
  const canonicalRoot = getCanonicalRoot(repoRoot);
  if (!existsSync(canonicalRoot)) {
    throw new Error(`Canonical skill root does not exist: ${canonicalRoot}`);
  }

  return readdirSync(canonicalRoot)
    .filter((entry) => statSync(join(canonicalRoot, entry)).isDirectory())
    .filter((entry) => existsSync(join(canonicalRoot, entry, 'SKILL.md')))
    .sort();
}

function getExpectedFiles(repoRoot, skillDirs) {
  const canonicalRoot = getCanonicalRoot(repoRoot);
  return skillDirs
    .flatMap((skillDir) =>
      listFiles(join(canonicalRoot, skillDir)).map((filePath) => join(skillDir, filePath)),
    )
    .sort();
}

export function generateRepoSkills(repoRoot) {
  const canonicalRoot = getCanonicalRoot(repoRoot);
  const skillDirs = listCanonicalSkills(repoRoot);

  for (const targetRootRel of TARGET_SKILL_ROOTS) {
    const targetRoot = join(repoRoot, targetRootRel);
    rmSync(targetRoot, { recursive: true, force: true });
    mkdirSync(targetRoot, { recursive: true });

    for (const skillDir of skillDirs) {
      cpSync(join(canonicalRoot, skillDir), join(targetRoot, skillDir), { recursive: true });
    }
  }

  return {
    canonicalRoot,
    skillDirs,
    targetRoots: TARGET_SKILL_ROOTS.map((targetRootRel) => join(repoRoot, targetRootRel)),
  };
}

export function checkRepoSkills(repoRoot) {
  const canonicalRoot = getCanonicalRoot(repoRoot);
  const skillDirs = listCanonicalSkills(repoRoot);
  const expectedFiles = getExpectedFiles(repoRoot, skillDirs);
  const errors = [];

  for (const targetRootRel of TARGET_SKILL_ROOTS) {
    const targetRoot = join(repoRoot, targetRootRel);
    if (!existsSync(targetRoot)) {
      errors.push(`Missing mirror root: ${targetRoot}`);
      continue;
    }

    const targetFiles = listFiles(targetRoot);
    if (JSON.stringify(targetFiles) !== JSON.stringify(expectedFiles)) {
      errors.push(
        [
          `Mirror tree differs for ${targetRootRel}.`,
          `expected: ${JSON.stringify(expectedFiles)}`,
          `actual: ${JSON.stringify(targetFiles)}`,
        ].join('\n'),
      );
      continue;
    }

    for (const relativePath of expectedFiles) {
      const sourcePath = join(canonicalRoot, relativePath);
      const targetPath = join(targetRoot, relativePath);
      const sourceContent = readFileSync(sourcePath, 'utf8');
      const targetContent = readFileSync(targetPath, 'utf8');
      if (sourceContent !== targetContent) {
        errors.push(`Mirror file differs for ${targetRootRel}: ${relativePath}`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n\n'));
  }

  return {
    canonicalRoot,
    skillDirs,
    targetRoots: TARGET_SKILL_ROOTS.map((targetRootRel) => join(repoRoot, targetRootRel)),
  };
}
