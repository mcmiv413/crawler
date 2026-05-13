import { relative } from 'node:path';
import { generateRepoSkills, resolveRepoRoot } from './repo-skills-lib.mjs';

const repoRoot = resolveRepoRoot(process.argv.slice(2));
const { canonicalRoot, skillDirs, targetRoots } = generateRepoSkills(repoRoot);

console.log(`Generated ${skillDirs.length} repo skills from ${relative(repoRoot, canonicalRoot)}.`);
for (const targetRoot of targetRoots) {
  console.log(`- ${relative(repoRoot, targetRoot)}`);
}
