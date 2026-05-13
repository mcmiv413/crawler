import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const BANNED_FILE_RULES = [
  {
    pattern: /(^|\/)\.eslintcache[^/]*$/,
    reason: 'ESLint caches are local artifacts and must never be tracked or staged.',
  },
  {
    pattern: /:Zone\.Identifier$/,
    reason: 'Windows Zone.Identifier files are OS metadata artifacts and must stay out of git.',
  },
  {
    pattern: /\.d\.ts\.map$/,
    reason: 'TypeScript declaration source maps are generated artifacts and must stay untracked.',
  },
  {
    pattern: /\.js\.map$/,
    reason: 'JavaScript source maps are generated artifacts and must stay untracked.',
  },
];

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

function runGit(repoRoot, args) {
  const result = spawnSync('git', ['-C', repoRoot, ...args], {
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || '').trim() || `git ${args.join(' ')} failed`);
  }

  return result.stdout;
}

function listGitPaths(repoRoot, args) {
  return runGit(repoRoot, args)
    .split('\0')
    .filter(Boolean)
    .sort();
}

export function findTrackedArtifacts(repoRoot = resolveRepoRoot()) {
  const trackedPaths = listGitPaths(repoRoot, ['ls-files', '-z']);
  const stagedPaths = listGitPaths(repoRoot, ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']);
  const candidatePaths = [...new Set([...trackedPaths, ...stagedPaths])].sort();

  return candidatePaths.flatMap((relativePath) => {
    const matches = BANNED_FILE_RULES.filter(({ pattern }) => pattern.test(relativePath));
    if (matches.length === 0) {
      return [];
    }

    return [
      {
        relativePath,
        reasons: matches.map(({ reason }) => reason),
      },
    ];
  });
}

export function checkTrackedArtifacts(repoRoot = resolveRepoRoot()) {
  const failures = findTrackedArtifacts(repoRoot);
  if (failures.length > 0) {
    const details = failures
      .map(({ relativePath, reasons }) => `- ${relativePath}\n  ${reasons.join('\n  ')}`)
      .join('\n');
    throw new Error(
      [
        'Tracked artifact check failed:',
        details,
        '',
        'These files must stay out of git. .gitignore alone is not enough because force-adds and already tracked files bypass ignore rules.',
      ].join('\n'),
    );
  }

  console.log('Tracked artifact check passed.');
}

function runCli() {
  try {
    checkTrackedArtifacts(resolveRepoRoot(process.argv.slice(2)));
  } catch (err) {
    if (err instanceof Error) {
      console.error(err.message);
    } else {
      console.error(String(err));
    }
    process.exit(1);
  }
}

runCli();
