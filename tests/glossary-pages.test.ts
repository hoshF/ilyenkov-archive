import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getGlossary } from '../src/lib/glossary';
import { searchGlossary } from '../src/lib/glossary-query';

const entries = getGlossary();
const html = readFileSync('dist/glossary/index.html', 'utf8');

describe('single page glossary', () => {
  it('renders each approved entry with a unique stable anchor and all fields', () => {
    expect(new Set(entries.map(e => e.route)).size).toBe(entries.length);
    for (const entry of entries) {
      const id = entry.route.split('#')[1];
      expect(html).toContain(`id="${id}"`);
      expect(html).toContain(`data-glossary-entry="${entry.route}"`);
    }
    expect(existsSync('dist/glossary/ilyenkov/ideal/index.html')).toBe(false);
    expect(html).toContain('href="/glossary.json"');
    expect(html).toContain('data-glossary-data');
  });
  it('publishes exactly the validated approved input as JSON', () => {
    expect(JSON.parse(readFileSync('dist/glossary.json', 'utf8'))).toEqual(JSON.parse(readFileSync('.website-input/glossary.json', 'utf8')));
  });
  it('ranks names and forms ahead of matching notes', () => {
    const base = entries[0]!;
    const name = { ...base, zh_preferred: 'sentinel', notes: '' };
    const notes = { ...base, zh_preferred: 'other', canonical: 'other', forms: [], zh_alternatives: [], notes: 'sentinel' };
    expect(searchGlossary([notes, name], { query: 'sentinel' })).toEqual([name, notes]);
  });
  it('includes only the single glossary page in the sitemap', () => {
    const sitemap = readFileSync('dist/sitemap-0.xml', 'utf8');
    expect(sitemap).toContain('https://ilyenkov.cn/glossary/');
    expect(sitemap).not.toContain('https://ilyenkov.cn/glossary/ilyenkov/ideal/');
  });
});
