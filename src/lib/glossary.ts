import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildCache } from './cache';
import { GeneratedGlossarySchema } from './glossary-record.mjs';
import { compareGlossaryEntries, toGlossaryEntry, type GlossaryEntry } from './glossary-query';

export type { GlossaryEntry } from './glossary-query';

const glossaryPath = path.join(process.cwd(), '.website-input', 'glossary.json');

export const getGlossary = buildCache((): GlossaryEntry[] => {
  const records = GeneratedGlossarySchema.parse(JSON.parse(readFileSync(glossaryPath, 'utf8')));
  return records.map(toGlossaryEntry).sort(compareGlossaryEntries);
});
