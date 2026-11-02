import { readFileSync } from 'node:fs';
import path from 'node:path';
import { GeneratedGlossarySchema } from '../lib/glossary-record.mjs';

export function GET() {
  const data = GeneratedGlossarySchema.parse(JSON.parse(readFileSync(path.join(process.cwd(), '.website-input', 'glossary.json'), 'utf8')));
  return new Response(JSON.stringify(data, null, 2) + '\n', { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
