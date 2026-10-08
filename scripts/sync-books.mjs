import path from 'node:path';
import { outputRoot, researchRoot } from './lib/paths.mjs';
import { plannedBooks } from './lib/book-sync.mjs';
import { runSync, writeGenerated } from './lib/sync.mjs';

runSync('Book record', ({ checkOnly }) => {
  const books = plannedBooks({ researchRoot });
  const stale = writeGenerated(path.join(outputRoot, 'books.json'), `${JSON.stringify(books, null, 2)}\n`, { checkOnly });
  console.log(`Book records synced: written=${stale && !checkOnly ? 1 : 0} stale=${stale ? 1 : 0}`);
  if (checkOnly && stale) process.exitCode = 1;
});
