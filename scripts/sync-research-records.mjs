import path from 'node:path';
import { outputRoot, projectRoot, researchRoot } from './lib/paths.mjs';
import { runSync, writeGenerated } from './lib/sync.mjs';
import { plannedResearchRecords } from './lib/research-sync/planner.mjs';

const outputPath = path.join(outputRoot, 'research-records.json');

runSync('Research record', ({ checkOnly }) => {
  const records = plannedResearchRecords({ projectRoot, researchRoot, outputRoot });
  const stale = writeGenerated(outputPath, `${JSON.stringify(records, null, 2)}\n`, { checkOnly });

  console.log(`Research records synced: written=${stale && !checkOnly ? 1 : 0} stale=${stale ? 1 : 0}`);
  if (checkOnly && stale) process.exitCode = 1;
});
