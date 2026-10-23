import { existsSync, readdirSync, readFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { outputRoot, projectRoot, researchRoot } from './lib/paths.mjs';
import { runSync, writeGenerated } from './lib/sync.mjs';
import { plannedResearchOutputs } from './lib/research-sync/planner.mjs';

const outputPath = path.join(outputRoot, 'research-records.json');
const portraitsRoot = path.join(outputRoot, 'portraits');

runSync('Research record', ({ checkOnly }) => {
  const { records, portraits } = plannedResearchOutputs({ projectRoot, researchRoot, outputRoot });
  let written = 0;
  let stale = 0;
  const record = (changed) => {
    if (!changed) return;
    stale += 1;
    if (!checkOnly) written += 1;
  };

  record(writeGenerated(outputPath, `${JSON.stringify(records, null, 2)}\n`, { checkOnly }));
  // 撤回选择的照片随之移出生成输入，不留在下一次构建里。
  for (const entry of existsSync(portraitsRoot) ? readdirSync(portraitsRoot, { withFileTypes: true }) : []) {
    if (!entry.isFile() || portraits.has(entry.name)) continue;
    stale += 1;
    if (!checkOnly) unlinkSync(path.join(portraitsRoot, entry.name));
  }
  for (const [filename, source] of portraits) {
    record(writeGenerated(path.join(portraitsRoot, filename), readFileSync(source), { checkOnly }));
  }

  console.log(`Research records synced: written=${written} stale=${stale}`);
  if (checkOnly && stale) process.exitCode = 1;
});
