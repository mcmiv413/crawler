import { readFileSync } from 'fs';
const lines = readFileSync('/home/michael/.claude/projects/-home-michael-claude-rpg-public/f1bc364f-df2c-4986-bc59-ed4696325a1c/tool-results/b2w0sfnw3.txt', 'utf8').split('\n');
const errors = lines.filter(l => l.includes('error TS') && !l.includes('TS6059'));
errors.forEach(e => console.log(e));
