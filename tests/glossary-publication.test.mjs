import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { plannedGlossary } from '../scripts/lib/glossary-sync.mjs';

const roots = [];
const projectRoot = process.cwd();
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

function approved(overrides = {}) {
  return {
    id: 'materialnoe', canonical: 'материальное', forms: ['материальный', 'материального'],
    zh_preferred: '物质的东西', zh_alternatives: ['物质'],
    notes: '  依语境使用。\n参见 glossary/unselected.json。  ', status: 'approved',
    type: 'person', private_source: 'source_files/restricted.pdf', ...overrides,
  };
}

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'glossary-publication-'));
  roots.push(root);
  const sourceRoot = path.join(root, 'private');
  const publicRoot = path.join(root, 'public');
  const manifest = { glossary: { publication_scope: 'website_public', source_paths: ['glossary/terms.json'] } };
  const tables = { terms: [approved()] };
  const write = (relative, value) => {
    const file = path.join(sourceRoot, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(value));
  };
  const save = () => {
    write('web/publication.json', manifest);
    for (const [collection, entries] of Object.entries(tables)) write(`glossary/${collection}.json`, entries);
  };
  save();
  const output = path.join(publicRoot, '.website-input/glossary.json');
  return {
    root, sourceRoot, publicRoot, manifest, tables, output, write, save,
    plan: () => plannedGlossary({ researchRoot: sourceRoot }),
    run(check = false) {
      cpSync(path.join(projectRoot, 'scripts/lib'), path.join(publicRoot, 'scripts/lib'), { recursive: true });
      cpSync(path.join(projectRoot, 'scripts/sync-glossary.mjs'), path.join(publicRoot, 'scripts/sync-glossary.mjs'));
      mkdirSync(path.join(publicRoot, 'src/lib'), { recursive: true });
      cpSync(path.join(projectRoot, 'src/lib/glossary-record.mjs'), path.join(publicRoot, 'src/lib/glossary-record.mjs'));
      if (!existsSync(path.join(publicRoot, 'node_modules'))) {
        symlinkSync(path.join(projectRoot, 'node_modules'), path.join(publicRoot, 'node_modules'), 'dir');
      }
      return spawnSync(process.execPath, ['scripts/sync-glossary.mjs', ...(check ? ['--check'] : [])], {
        cwd: publicRoot, env: { ...process.env, ILYENKOV_ROOT: sourceRoot }, encoding: 'utf8', timeout: 10000,
      });
    },
  };
}

function outputSnapshot(file) {
  return { content: readFileSync(file, 'utf8'), modified: statSync(file).mtimeMs };
}

function expectExit(result, status) {
  expect(result.status, result.stderr || result.stdout).toBe(status);
}

describe('explicit glossary publication', () => {
  it('projects only approved public fields and preserves source notes without following their references', () => {
    const input = fixture();
    input.tables.terms.push({ id: 'unfinished', status: 'needs_review' }, { id: 'unselected-status' });
    input.write('glossary/unselected.json', { invalid: 'not a term array' });
    input.save();
    const [entry] = input.plan();
    expect(input.plan()).toHaveLength(1);
    expect(entry).toEqual({
      collection: 'terms', id: 'materialnoe', canonical: 'материальное',
      forms: ['материальный', 'материального'], zh_preferred: '物质的东西',
      zh_alternatives: ['物质'], notes: input.tables.terms[0].notes,
    });
  });

  it('preserves separate identities for the same id in different tables and includes type only for names', () => {
    const input = fixture();
    input.tables.glossary = [approved({ type: 'person', zh_preferred: '某人' })];
    input.tables.ilyenkov = [approved({ type: 'not-a-name-type' })];
    input.manifest.glossary.source_paths = ['glossary/terms.json', 'glossary/glossary.json', 'glossary/ilyenkov.json'];
    input.save();
    const entries = input.plan();
    expect(entries).toHaveLength(3);
    expect(entries.map(({ collection, id }) => `${collection}/${id}`).sort())
      .toEqual(['glossary/materialnoe', 'ilyenkov/materialnoe', 'terms/materialnoe']);
    expect(entries.find(({ collection }) => collection === 'glossary').type).toBe('person');
    expect(entries.filter(({ collection }) => collection !== 'glossary').every((entry) => !Object.hasOwn(entry, 'type'))).toBe(true);
  });

  it.each(['person', 'organization', 'institution', 'work', 'journal'])('allows the names type %s', (type) => {
    const input = fixture();
    input.tables.glossary = [approved({ type })];
    input.manifest.glossary.source_paths = ['glossary/glossary.json'];
    input.save();
    expect(input.plan()[0].type).toBe(type);
  });

  it.each(['unselected', 'internal_public', 'unauthorized', 'empty'])('does not read unpublished source tables: %s', (scope) => {
    const input = fixture();
    if (scope === 'unselected') delete input.manifest.glossary;
    else if (scope === 'empty') input.manifest.glossary.source_paths = [];
    else input.manifest.glossary = { publication_scope: scope, source_paths: ['glossary/missing.json'] };
    input.save();
    rmSync(path.join(input.sourceRoot, 'glossary'), { recursive: true });
    expect(input.plan()).toEqual([]);
  });

  it.each(['draft', 'needs_review', 'rejected', 'APPROVED', undefined])('never publishes status %s', (status) => {
    const input = fixture();
    input.tables.terms = [{ id: 'private-term', status }];
    input.save();
    expect(input.plan()).toEqual([]);
  });

  it.each([
    ['extra selection field', (input) => { input.manifest.glossary.status = 'draft'; }],
    ['missing source_paths', (input) => { delete input.manifest.glossary.source_paths; }],
    ['non-array source_paths', (input) => { input.manifest.glossary.source_paths = 'glossary/terms.json'; }],
    ['duplicate source_paths', (input) => { input.manifest.glossary.source_paths.push('glossary/terms.json'); }],
    ['non-string source path', (input) => { input.manifest.glossary.source_paths = [null]; }],
  ])('rejects invalid publication selection: %s', (_name, change) => {
    const input = fixture(); change(input); input.save();
    expect(() => input.plan()).toThrow();
  });

  it.each([
    '/glossary/terms.json', '../glossary/terms.json', 'research/terms.json',
    'glossary/../glossary/terms.json', 'glossary/nested/terms.json',
    'glossary/Terms.json', 'glossary/some_terms.json', 'glossary/terms.txt', 'glossary/terms.json\n',
  ])('rejects an unsupported or escaping path: %s', (relative) => {
    const input = fixture(); input.manifest.glossary.source_paths = [relative]; input.save();
    expect(() => input.plan()).toThrow();
  });

  it('rejects a selected file symlink pointing outside glossary', () => {
    const input = fixture();
    input.write('outside.json', input.tables.terms);
    const file = path.join(input.sourceRoot, 'glossary/terms.json');
    rmSync(file);
    symlinkSync(path.join(input.sourceRoot, 'outside.json'), file);
    expect(() => input.plan()).toThrow();
  });

  it.each(['within private root', 'outside private root'])('rejects a glossary directory symlink that escapes glossary: %s', (location) => {
    const input = fixture();
    const outside = path.join(location === 'within private root' ? input.sourceRoot : input.root, 'outside-glossary');
    mkdirSync(outside);
    writeFileSync(path.join(outside, 'terms.json'), JSON.stringify(input.tables.terms));
    const glossary = path.join(input.sourceRoot, 'glossary');
    rmSync(glossary, { recursive: true });
    symlinkSync(outside, glossary, 'dir');
    expect(() => input.plan()).toThrow();
  });

  it.each([
    ['missing selected file', (input) => { rmSync(path.join(input.sourceRoot, 'glossary/terms.json')); }],
    ['invalid JSON', (input) => { writeFileSync(path.join(input.sourceRoot, 'glossary/terms.json'), '{'); }],
    ['object instead of array', (input) => { input.write('glossary/terms.json', { entries: input.tables.terms }); }],
    ['null entry', (input) => { input.write('glossary/terms.json', [null]); }],
    ['array entry', (input) => { input.write('glossary/terms.json', [[]]); }],
    ['string entry', (input) => { input.write('glossary/terms.json', ['private-term']); }],
  ])('rejects invalid selected table: %s', (_name, change) => {
    const input = fixture(); change(input);
    expect(() => input.plan()).toThrow();
  });

  it.each(['approved', 'needs_review'])('rejects duplicate ids even when the second entry is %s', (status) => {
    const input = fixture(); input.tables.terms.push(approved({ status })); input.save();
    expect(() => input.plan()).toThrow();
  });

  it.each([undefined, '', 7])('requires an identity even for unpublished terms: %s', (id) => {
    const input = fixture(); input.tables.terms = [{ id, status: 'needs_review' }]; input.save();
    expect(() => input.plan()).toThrow();
  });

  it.each(['Bad-ID', 'bad_id', 'materialnoe\n'])('requires an approved id to be a complete slug: %j', (id) => {
    const input = fixture(); input.tables.terms = [approved({ id })]; input.save();
    expect(() => input.plan()).toThrow();
  });

  it.each(['canonical', 'forms', 'zh_preferred', 'zh_alternatives', 'notes'])('requires the approved field %s', (field) => {
    const input = fixture(); delete input.tables.terms[0][field]; input.save();
    expect(() => input.plan()).toThrow();
  });

  it.each([
    ['canonical', ''], ['canonical', '  '], ['canonical', null],
    ['zh_preferred', ''], ['zh_preferred', 1],
    ['forms', 'материальный'], ['forms', ['']], ['forms', [null]],
    ['zh_alternatives', null], ['zh_alternatives', ['']], ['zh_alternatives', [1]],
    ['notes', null], ['notes', []],
  ])('rejects invalid approved %s: %j', (field, value) => {
    const input = fixture(); input.tables.terms[0][field] = value; input.save();
    expect(() => input.plan()).toThrow();
  });

  it('allows empty optional content without inventing text', () => {
    const input = fixture();
    input.tables.terms = [approved({ forms: [], zh_alternatives: [], notes: '' })]; input.save();
    expect(input.plan()[0]).toMatchObject({ forms: [], zh_alternatives: [], notes: '' });
  });

  it.each([undefined, '', 'concept', null])('requires a valid type for approved names: %s', (type) => {
    const input = fixture();
    input.tables.glossary = [approved({ type })];
    input.manifest.glossary.source_paths = ['glossary/glossary.json']; input.save();
    expect(() => input.plan()).toThrow();
  });

  it('reports missing output without creating it, then keeps unchanged synchronization read-only', () => {
    const input = fixture();
    expectExit(input.run(true), 1);
    expect(existsSync(path.dirname(input.output))).toBe(false);
    expectExit(input.run(), 0);
    expect(JSON.parse(readFileSync(input.output, 'utf8'))).toEqual(input.plan());
    const timestamp = new Date('2020-01-01T00:00:00Z');
    utimesSync(input.output, timestamp, timestamp);
    const before = outputSnapshot(input.output);
    expectExit(input.run(true), 0);
    expect(outputSnapshot(input.output)).toEqual(before);
    expectExit(input.run(), 0);
    expect(outputSnapshot(input.output)).toEqual(before);
  });

  it('reports changed public content without writing it, then updates through the actual CLI', () => {
    const input = fixture(); expectExit(input.run(), 0);
    const before = outputSnapshot(input.output);
    input.tables.terms[0].canonical = 'изменено'; input.tables.terms[0].notes = '修订的用法说明。'; input.save();
    expectExit(input.run(true), 1);
    expect(outputSnapshot(input.output)).toEqual(before);
    expectExit(input.run(), 0);
    expect(JSON.parse(readFileSync(input.output, 'utf8'))[0]).toMatchObject({ canonical: 'изменено', notes: '修订的用法说明。' });
    expectExit(input.run(true), 0);
  });

  it.each([
    ['status', (input) => { input.tables.terms[0].status = 'needs_review'; }],
    ['entry', (input) => { input.tables.terms = []; }],
    ['table', (input) => { input.manifest.glossary.source_paths = []; }],
    ['root', (input) => { delete input.manifest.glossary; }],
    ['scope', (input) => { input.manifest.glossary.publication_scope = 'internal_public'; }],
  ])('removes withdrawn %s content on normal synchronization; check never writes', (_name, change) => {
    const input = fixture(); expectExit(input.run(), 0);
    const before = outputSnapshot(input.output);
    change(input); input.save();
    expectExit(input.run(true), 1);
    expect(outputSnapshot(input.output)).toEqual(before);
    expectExit(input.run(), 0);
    expect(JSON.parse(readFileSync(input.output, 'utf8'))).toEqual([]);
    expectExit(input.run(true), 0);
  });

  it.each([
    ['malformed JSON', (input) => { writeFileSync(path.join(input.sourceRoot, 'glossary/terms.json'), '{'); }],
    ['missing selected file', (input) => { rmSync(path.join(input.sourceRoot, 'glossary/terms.json')); }],
    ['invalid approved field', (input) => { input.tables.terms[0].zh_preferred = ''; input.save(); }],
    ['duplicate id', (input) => { input.tables.terms.push(approved()); input.save(); }],
  ])('fails closed for %s and removes old output only during normal synchronization', (_name, change) => {
    const input = fixture(); expectExit(input.run(), 0);
    const before = outputSnapshot(input.output);
    change(input);
    const checked = input.run(true);
    expectExit(checked, 2);
    expect(checked.stderr).toMatch(/sync error:/);
    expect(outputSnapshot(input.output)).toEqual(before);
    const failed = input.run();
    expectExit(failed, 2);
    expect(failed.stderr).toMatch(/sync error:/);
    expect(existsSync(input.output)).toBe(false);
    expectExit(input.run(true), 2);
    expect(existsSync(input.output)).toBe(false);
  });
});
