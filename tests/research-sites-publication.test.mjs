import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResearchRecordsSchema } from '../src/lib/research-record.mjs';
import { getPublicResearchRecords, getPublicResearchSites } from '../src/lib/research-records';
import { researcherFixture, publicationPath, researcherId } from './helpers/researcher-publication-fixture.mjs';

const injected = vi.hoisted(() => ({ records: undefined }));
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    readFileSync(file, ...args) {
      if (injected.records !== undefined && String(file) === path.join(process.cwd(), '.website-input/research-records.json')) {
        return JSON.stringify(injected.records);
      }
      return actual.readFileSync(file, ...args);
    },
  };
});

const sitePath = 'research/fixture/site.json';
const selectedSite = manifest => manifest.records.find(entry => entry.kind === 'research_site');
const fixtures = [];
afterEach(() => {
  injected.records = undefined;
  fixtures.splice(0).forEach(input => input.cleanup());
});

function fixture() {
  const input = researcherFixture(); fixtures.push(input);
  input.mutate(sitePath, source => {
    source.files = [{ file: 'archive/fixture.html', url: 'https://example.test/site-file' }];
  });
  input.mutate(publicationPath, manifest => {
    Object.assign(selectedSite(manifest).sections[0], { file_path: 'archive/fixture.html', url: 'https://example.test/site-file' });
    manifest.timeline.record_kinds = ['biography_event', 'military_service', 'hegel_congress'];
  });
  input.write('web/editorial/fixture-life.json', {
    description: 'Synthetic life.', lead: 'Synthetic lead.', note: 'Synthetic note.',
    stages: [{ title: 'Synthetic stage', record_ids: ['fixture-biography', 'fixture-military'], links: [{ target: 'circle', label: 'Synthetic link' }] }],
  });
  input.write('web/editorial/fixture-circle.json', {
    description: 'Synthetic circle.', sections: [{ title: 'Synthetic section', lead: 'Synthetic lead.', record_kind: 'biography_event' }],
  });
  return input;
}

function withdrawSites(input) {
  input.mutate(publicationPath, manifest => { manifest.records = manifest.records.filter(entry => entry.kind !== 'research_site'); });
  input.remove(sitePath);
}

function snapshot(root) {
  if (!existsSync(root)) return null;
  const entries = [];
  const visit = file => {
    const stat = statSync(file, { bigint: true });
    entries.push({ path: path.relative(root, file), mode: String(stat.mode), mtime: String(stat.mtimeNs),
      content: stat.isFile() ? readFileSync(file).toString('base64') : null });
    if (stat.isDirectory()) readdirSync(file).sort().forEach(name => visit(path.join(file, name)));
  };
  visit(root);
  return entries;
}

describe('research sites publication and withdrawal', () => {
  it.each([undefined, 'internal_public', 'unauthorized'])('plans and reads an empty collection with no authorized sites (scope=%s)', (scope) => {
    const input = fixture();
    const before = input.plan();
    withdrawSites(input);
    if (scope !== undefined) input.mutate(publicationPath, manifest => {
      manifest.records.push({ public_id: 'unselected-site', kind: 'research_site', publication_scope: scope, record_path: 'private/missing.json' });
    });
    const after = input.plan();
    expect(after).toEqual({ ...before, researchSites: [] });
    expect(ResearchRecordsSchema.parse(after)).toEqual(after);
    injected.records = after;
    expect(getPublicResearchRecords()).toEqual(after);
    expect(getPublicResearchSites()).toEqual([]);
    delete injected.records.researchSites;
    expect(() => getPublicResearchRecords()).toThrow();
  });

  const invalid = [
    ['missing source catalog', input => input.remove(sitePath)],
    ['wrong site identity', input => input.mutate(sitePath, source => { source.site = 'Unrelated synthetic site'; })],
    ['missing source page', input => input.mutate(sitePath, source => { source.source_pages = []; })],
    ['ambiguous source page', input => input.mutate(sitePath, source => { source.source_pages.push(structuredClone(source.source_pages[0])); })],
    ['source page without the selected section', input => input.mutate(sitePath, source => { source.source_pages[0].sections = []; })],
    ['invalid source page URL', input => input.mutate(sitePath, source => { source.source_pages[0].page = 'file:///synthetic'; })],
    ['invalid site URL', input => input.mutate(publicationPath, manifest => { selectedSite(manifest).site_url = 'ftp://example.test/site'; })],
    ['site URL outside the source pages', input => input.mutate(publicationPath, manifest => { selectedSite(manifest).site_url = 'https://example.test/other'; })],
    ['empty section selection', input => input.mutate(publicationPath, manifest => { selectedSite(manifest).sections = []; })],
    ['unknown section', input => input.mutate(publicationPath, manifest => { selectedSite(manifest).sections[0].section_id = 'unknown'; })],
    ['repeated selected section', input => input.mutate(publicationPath, manifest => { selectedSite(manifest).sections.push(structuredClone(selectedSite(manifest).sections[0])); })],
    ['empty section label', input => input.mutate(publicationPath, manifest => { selectedSite(manifest).sections[0].label_zh = ' '; })],
    ['invalid section URL', input => input.mutate(publicationPath, manifest => { selectedSite(manifest).sections[0].url = 'file:///synthetic'; })],
    ['missing selected file', input => input.mutate(sitePath, source => { source.files = []; })],
    ['ambiguous selected file', input => input.mutate(sitePath, source => { source.files.push(structuredClone(source.files[0])); })],
    ['selected file with a different URL', input => input.mutate(sitePath, source => { source.files[0].url = 'https://example.test/other'; })],
    ['invalid source file URL', input => input.mutate(sitePath, source => { source.files[0].url = 'ftp://example.test/file'; })],
    ['non-file entry outside its source page', input => input.mutate(publicationPath, manifest => { delete selectedSite(manifest).sections[0].file_path; })],
  ];
  it.each(invalid)('still rejects %s during planning', (_label, mutate) => {
    const input = fixture();
    expect(input.plan().researchSites).toHaveLength(1);
    mutate(input);
    expect(() => input.plan()).toThrow();
  });

  it('withdraws every site through the CLI, preserving other data, references and selected portraits', () => {
    const input = fixture();
    input.writeBytes('people/fixture/portrait.jpg', Buffer.from('SYNTHETIC_PORTRAIT'));
    input.mutate(publicationPath, manifest => {
      manifest.records.find(entry => entry.public_id === researcherId).portrait_path = 'people/fixture/portrait.jpg';
    });
    const initial = input.run();
    expect(initial.status, initial.stderr).toBe(0);
    const original = input.generated();
    expect(original.researchSites).toHaveLength(1);
    const root = path.join(input.publicRoot, '.website-input');
    mkdirSync(path.join(root, 'articles'));
    writeFileSync(path.join(root, 'articles/unrelated.md'), 'UNRELATED_GENERATED_ARTICLE');
    const before = snapshot(root);
    withdrawSites(input);
    const check = input.run(true);
    expect(check.status, check.stderr).toBe(1);
    expect(snapshot(root)).toEqual(before);
    const write = input.run();
    expect(write.status, write.stderr).toBe(0);
    const expected = { ...original, researchSites: [] };
    expect(input.generated()).toEqual(expected);
    expect(readFileSync(path.join(root, 'research-records.json'), 'utf8')).toBe(`${JSON.stringify(expected, null, 2)}\n`);
    expect(JSON.stringify(input.generated())).not.toContain('fixture-site');
    expect(snapshot(root).filter(entry => entry.path !== 'research-records.json')).toEqual(before.filter(entry => entry.path !== 'research-records.json'));
    const after = snapshot(root);
    const clean = input.run(true);
    expect(clean.status, clean.stderr).toBe(0);
    expect(snapshot(root)).toEqual(after);
    injected.records = input.generated();
    expect(getPublicResearchSites()).toEqual([]);
  });

  it('keeps generated input intact when a selected site is invalid', () => {
    const input = fixture();
    expect(input.run().status).toBe(0);
    const root = path.join(input.publicRoot, '.website-input');
    mkdirSync(path.join(root, 'portraits'));
    writeFileSync(path.join(root, 'portraits/withdrawn.jpg'), 'WITHDRAWN_PORTRAIT');
    const before = snapshot(root);
    input.mutate(sitePath, source => { source.source_pages.push(structuredClone(source.source_pages[0])); });
    for (const checkOnly of [true, false]) {
      const result = input.run(checkOnly);
      expect(result.status, result.stderr).toBe(2);
      expect(result.stderr).toMatch(/source page.*exactly one/);
      expect(snapshot(root)).toEqual(before);
    }
  });
});
