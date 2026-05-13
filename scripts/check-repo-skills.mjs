import { relative } from 'node:path';
import { checkRepoSkills, resolveRepoRoot } from './repo-skills-lib.mjs';

const repoRoot = resolveRepoRoot(process.argv.slice(2));
const { canonicalRoot, skillDirs, targetRoots } = checkRepoSkills(repoRoot);

console.log(
  `Repo skill mirrors match ${relative(repoRoot, canonicalRoot)} for ${skillDirs.length} skills across ${targetRoots.length} targets.`,
);
