import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { plannedResearchRecords } from './lib/research-sync/planner.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const researchRoot = path.resolve(
  process.env.ILYENKOV_ROOT?.trim() || path.join(projectRoot, '..', 'Ilyenkov'),
);
const outputRoot = path.join(projectRoot, '.website-input');
const outputPath = path.join(outputRoot, 'research-records.json');

function sync({ checkOnly = false } = {}) {
  const records = plannedResearchRecords({ projectRoot, researchRoot, outputRoot });
  const content = `${JSON.stringify(records, null, 2)}\n`;
  const current = existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : null;
  const stale = current !== content;
  if (stale && !checkOnly) {
    mkdirSync(outputRoot, { recursive: true });
    writeFileSync(outputPath, content, 'utf8');
  }
  console.log(`Research records synced: written=${stale && !checkOnly ? 1 : 0} stale=${stale ? 1 : 0}`);
  if (checkOnly && stale) process.exitCode = 1;
}

try {
  sync({ checkOnly: process.argv.includes('--check') });
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
