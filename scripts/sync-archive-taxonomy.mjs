import { existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { outputRoot, researchRoot } from './lib/paths.mjs';
import { plannedArchiveTaxonomy } from './lib/archive-taxonomy-sync.mjs';
import { runSync, writeGenerated } from './lib/sync.mjs';

runSync('Archive taxonomy', ({ checkOnly }) => {
  const output = path.join(outputRoot, 'archive-taxonomy.json');
  const articles = path.join(outputRoot, 'articles');
  const articleIds = existsSync(articles)
    ? readdirSync(articles).filter((name) => name.endsWith('.md')).map((name) => name.slice(0, -3)) : [];
  let taxonomy;
  try {
    taxonomy = plannedArchiveTaxonomy({ researchRoot, articleIds });
  } catch (error) {
    // Invalid references must not leave a previous taxonomy exposing withdrawn article IDs.
    if (!checkOnly) rmSync(output, { force: true });
    throw error;
  }
  const stale = taxonomy === null ? existsSync(output)
    : writeGenerated(output, `${JSON.stringify(taxonomy, null, 2)}\n`, { checkOnly });
  if (taxonomy === null && !checkOnly) rmSync(output, { force: true });
  console.log(`Archive taxonomy synced: written=${taxonomy !== null && stale && !checkOnly ? 1 : 0} stale=${stale ? 1 : 0}`);
  if (checkOnly && stale) process.exitCode = 1;
});
