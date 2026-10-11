import { rmSync } from 'node:fs';
import path from 'node:path';
import { outputRoot, researchRoot } from './lib/paths.mjs';
import { plannedGlossary } from './lib/glossary-sync.mjs';
import { runSync, writeGenerated } from './lib/sync.mjs';

runSync('Glossary', ({ checkOnly }) => {
  const output = path.join(outputRoot, 'glossary.json');
  let glossary;
  try {
    glossary = plannedGlossary({ researchRoot });
  } catch (error) {
    if (!checkOnly) rmSync(output, { force: true });
    throw error;
  }
  const stale = writeGenerated(output, `${JSON.stringify(glossary, null, 2)}\n`, { checkOnly });
  console.log(`Glossary synced: entries=${glossary.length} written=${stale && !checkOnly ? 1 : 0} stale=${stale ? 1 : 0}`);
  if (checkOnly && stale) process.exitCode = 1;
});
