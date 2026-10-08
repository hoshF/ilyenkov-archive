import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { plannedResearchRecords } from '../scripts/lib/research-sync/planner.mjs';
import {
  getPublicTimelineEditorial,
  getPublicTimelineRecords,
  getPublicWorksEditorial,
  ResearchRecordsSchema,
} from '../src/lib/research-records';
import { builtRoutePath } from './helpers/pages';
import { researchRoot } from './helpers/publication';

const injected = vi.hoisted(() => ({
  bundle: null,
  file: `${process.cwd()}/.website-input/research-records.json`,
}));
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    readFileSync(file, ...options) {
      if (injected.bundle && String(file) === injected.file) return JSON.stringify(injected.bundle);
      return actual.readFileSync(file, ...options);
    },
  };
});

const projectRoot = process.cwd();
const publicationPath = 'web/publication.json';
const readJson = (root, relative) => JSON.parse(readFileSync(path.join(root, relative), 'utf8'));
const publication = readJson(researchRoot, publicationPath);
const selectedEntries = publication.records.filter((entry) => entry.publication_scope === 'website_public');
const collectionForKind = {
  biography_event: 'biography', military_service: 'military', hegel_congress: 'congresses',
};
const roots = [];

afterEach(() => {
  injected.bundle = null;
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
});

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'ilyenkov-pages-contract-'));
  roots.push(root);
  const sourceRoot = path.join(root, 'private');
  const publicRoot = path.join(root, 'public');
  const files = new Set([publicationPath, publication.timeline.editorial_path, publication.works_catalog.editorial_path]);
  for (const entry of selectedEntries) {
    for (const field of ['record_path', 'source_path', 'editorial_path']) {
      if (entry[field]) files.add(entry[field]);
    }
  }
  for (const relative of files) {
    const target = path.join(sourceRoot, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(path.join(researchRoot, relative)));
  }
  return {
    root, sourceRoot,
    read: (relative) => readJson(sourceRoot, relative),
    write(relative, value) {
      const target = path.join(sourceRoot, relative);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
    },
    mutate(relative, update) {
      const value = this.read(relative);
      update(value);
      this.write(relative, value);
    },
    plan: () => plannedResearchRecords({ projectRoot, researchRoot: sourceRoot }),
    remove: (relative) => rmSync(path.join(sourceRoot, relative)),
    run(checkOnly = false) {
      mkdirSync(path.join(publicRoot, 'scripts'), { recursive: true });
      cpSync(path.join(projectRoot, 'scripts/lib'), path.join(publicRoot, 'scripts/lib'), { recursive: true });
      cpSync(path.join(projectRoot, 'scripts/sync-research-records.mjs'), path.join(publicRoot, 'scripts/sync-research-records.mjs'));
      return spawnSync(process.execPath, ['scripts/sync-research-records.mjs', ...(checkOnly ? ['--check'] : [])], {
        cwd: publicRoot, env: { ...process.env, ILYENKOV_ROOT: sourceRoot }, encoding: 'utf8', timeout: 10_000,
      });
    },
    generated: () => readJson(publicRoot, '.website-input/research-records.json'),
  };
}

function expectedIds(bundle, kinds) {
  return kinds.flatMap((kind) => bundle[collectionForKind[kind]].map((record) => record.id));
}

describe('private timeline and works publication', () => {
  it('renders selected private descriptions and catalog notes in the static pages', () => {
    const bundle = fixture().plan();
    const timelineHtml = readFileSync(builtRoutePath('/ilyenkov/timeline'), 'utf8');
    const worksHtml = readFileSync(builtRoutePath('/ilyenkov/works'), 'utf8');
    expect(timelineHtml).toContain(bundle.timeline.editorial.description);
    for (const field of ['description', 'lead', 'note']) expect(worksHtml).toContain(bundle.worksCatalog.editorial[field]);
    for (const note of Object.values(bundle.worksCatalog.editorial.typeNotes)) expect(worksHtml).toContain(note);
    expect(bundle.timeline.editorial).toEqual(readJson(researchRoot, publication.timeline.editorial_path));
    expect(bundle.worksCatalog.editorial).toEqual(readJson(researchRoot, publication.works_catalog.editorial_path));
    expect(JSON.stringify(bundle)).not.toMatch(/editorial_path|record_kinds/);
  });

  it.each([['biography_event'], ['military_service', 'hegel_congress'], []].map((kinds) => [kinds]))(
    'uses only private-selected timeline kinds %j without changing shared facts', (kinds) => {
      const input = fixture();
      const before = input.plan();
      input.mutate(publicationPath, (manifest) => { manifest.timeline.record_kinds = kinds; });
      const after = input.plan();
      expect(after.timeline.recordIds).toEqual(expectedIds(before, kinds));
      for (const collection of ['biography', 'military', 'congresses', 'works']) expect(after[collection]).toEqual(before[collection]);
      injected.bundle = after;
      const renderedRecords = getPublicTimelineRecords();
      expect(new Set(renderedRecords.map((record) => record.id))).toEqual(new Set(after.timeline.recordIds));
      expect(renderedRecords.every((record, index) => index === 0 || renderedRecords[index - 1].period.start <= record.period.start)).toBe(true);
      expect(getPublicTimelineEditorial()).toEqual(after.timeline.editorial);
      expect(getPublicWorksEditorial()).toEqual(after.worksCatalog.editorial);
    },
  );

  it.each([null, 'biography_event', ['works_catalog'], ['biography_event', 'biography_event']].map((kinds) => [kinds]))(
    'rejects invalid timeline kind selection %j', (kinds) => {
      const input = fixture();
      input.mutate(publicationPath, (manifest) => { manifest.timeline.record_kinds = kinds; });
      expect(() => input.plan()).toThrow(/record_kinds/);
    },
  );

  it.each(['timeline', 'works_catalog'])('requires the %s root selection and manuscript', (key) => {
    const input = fixture();
    input.remove(publication[key].editorial_path);
    expect(() => input.plan()).toThrow(/missing.*web\/editorial/);
    input.mutate(publicationPath, (manifest) => { delete manifest[key]; });
    expect(() => input.plan()).toThrow(new RegExp(key));
  });

  it.each([
    ['timeline', 'recordIds', ['private-event']],
    ['works_catalog', 'record_ids', ['private-work']],
    ['timeline', 'layout', 'private-component'],
  ])('rejects an extra %s selection field %s', (key, field, value) => {
    const input = fixture();
    input.mutate(publicationPath, (manifest) => { manifest[key][field] = value; });
    expect(() => input.plan()).toThrow(/unsupported field/);
  });

  it.each(['timeline', 'works_catalog'])('rejects %s manuscript locators outside web editorial', (key) => {
    const input = fixture();
    input.mutate(publicationPath, (manifest) => { manifest[key].editorial_path = 'research/biography/records.json'; });
    expect(() => input.plan()).toThrow(/editorial_path/);
  });

  it('rejects a page manuscript symlink outside the editorial directory', () => {
    const input = fixture();
    const relative = publication.timeline.editorial_path;
    const outside = path.join(input.root, 'outside.json');
    writeFileSync(outside, JSON.stringify(input.read(relative)));
    input.remove(relative);
    symlinkSync(outside, path.join(input.sourceRoot, relative));
    expect(() => input.plan()).toThrow(/escapes web\/editorial/);
  });

  it.each([
    ['timeline', (text) => { text.description = ''; }],
    ['timeline', (text) => { text.description = 'First\nSecond'; }],
    ['timeline', (text) => { text.events = [{ date: '1924' }]; }],
    ['works_catalog', (text) => { delete text.lead; }],
    ['works_catalog', (text) => { text.css = 'private-style'; }],
    ['works_catalog', (text) => { text.typeNotes = []; }],
    ['works_catalog', (text) => { text.typeNotes = { 'Unselected type': 'Not permitted' }; }],
    ['works_catalog', (text) => { text.typeNotes = { '战时写作': ' ' }; }],
  ])('rejects invalid %s public editorial', (key, change) => {
    const input = fixture();
    input.mutate(publication[key].editorial_path, change);
    expect(() => input.plan()).toThrow(/editorial|description|lead|typeNotes/);
  });

  it('allows an empty type-note object without changing work classification', () => {
    const input = fixture();
    const before = input.plan();
    input.mutate(publication.works_catalog.editorial_path, (text) => { text.typeNotes = {}; });
    const after = input.plan();
    expect(after.worksCatalog.editorial.typeNotes).toEqual({});
    expect(after.works).toEqual(before.works);
    expect(ResearchRecordsSchema.safeParse(after).success).toBe(true);
  });

  it('projects work identity, original title and year from canonical facts, Chinese title and type from publication', () => {
    const input = fixture();
    const entry = selectedEntries.find((record) => record.kind === 'works_catalog');
    input.mutate(entry.record_path, (catalog) => {
      const work = catalog.works.find((record) => record.id === entry.record_id);
      work.title = 'CANONICAL_ORIGINAL_TITLE';
      work.year = '1961';
      work.work_kind = 'PRIVATE_INTERNAL_WORK_STATE';
    });
    const work = input.plan().works.find((record) => record.id === entry.public_id);
    expect(work).toMatchObject({ title: entry.title_zh, type: entry.work_type_zh, originalTitle: 'CANONICAL_ORIGINAL_TITLE', year: '1961' });
    expect(JSON.stringify(work)).not.toContain('PRIVATE_INTERNAL_WORK_STATE');
  });

  it('does not read internal selections or expand editorial mentions into canonical exports', () => {
    const input = fixture();
    const before = input.plan();
    input.mutate(publicationPath, (manifest) => {
      for (const scope of ['internal_public', 'unauthorized']) manifest.records.push({
        public_id: `${scope.replace('_', '-')}-activity`, publication_scope: scope,
        kind: 'biography_event', record_path: 'private/missing.json',
      });
    });
    input.mutate('research/biography/records.json', (catalog) => {
      catalog.events.push({ event_id: 'private-event', event_zh: 'PRIVATE_FACT_SENTINEL' });
    });
    input.write('web/editorial/unselected-page.json', { invalid: 'UNSELECTED_EDITORIAL_SENTINEL' });
    input.mutate(publication.timeline.editorial_path, (text) => { text.description = '{{record:private-event}}'; });
    const after = input.plan();
    expect(after.timeline.recordIds).toEqual(before.timeline.recordIds);
    expect(after.biography).toEqual(before.biography);
    expect(after.timeline.editorial.description).toBe('{{record:private-event}}');
    expect(JSON.stringify(after)).not.toMatch(/PRIVATE_FACT_SENTINEL|UNSELECTED_EDITORIAL_SENTINEL/);
  });

  it('cleans withdrawn activities, timeline kinds and works through the actual sync CLI', () => {
    const input = fixture();
    const first = input.run();
    expect(first.status, first.stderr).toBe(0);
    const activity = selectedEntries.find((entry) => entry.kind === 'biography_event');
    const work = selectedEntries.find((entry) => entry.kind === 'works_catalog' && entry.work_type_zh === '战时写作');
    input.mutate(publicationPath, (manifest) => {
      manifest.records = manifest.records.filter((entry) => ![activity.public_id, work.public_id].includes(entry.public_id));
      manifest.timeline.record_kinds = ['biography_event'];
    });
    const outdated = input.run(true);
    expect(outdated.status).toBe(1);
    const second = input.run();
    expect(second.status, second.stderr).toBe(0);
    const generated = input.generated();
    expect(generated.biography.some((record) => record.id === activity.public_id)).toBe(false);
    expect(generated.works.some((record) => record.id === work.public_id)).toBe(false);
    expect(generated.timeline.recordIds).toEqual(generated.biography.map((record) => record.id));
    expect(JSON.stringify(generated)).not.toContain(activity.public_id);
    expect(JSON.stringify(generated)).not.toContain(work.public_id);
    const checked = input.run(true);
    expect(checked.status, checked.stderr).toBe(0);
    expect(checked.stdout).toContain('stale=0');
    expect(ResearchRecordsSchema.safeParse(generated).success).toBe(true);
  });
});

describe('strict generated timeline and catalog references', () => {
  it.each([
    (bundle) => { bundle.timeline.recordIds = ['not-public']; },
    (bundle) => { bundle.timeline.recordIds = [bundle.works[0].id]; },
    (bundle) => { bundle.timeline.recordIds = [bundle.ifiSymposiums[0].id]; },
    (bundle) => { bundle.timeline.recordIds.push(bundle.timeline.recordIds[0]); },
    (bundle) => { bundle.biography.push(structuredClone(bundle.biography[0])); },
    (bundle) => { bundle.timeline.editorial.record_path = 'private.json'; },
    (bundle) => { bundle.worksCatalog.editorial.typeNotes['private type'] = 'Not permitted'; },
  ])('rejects private, ambiguous, duplicate or cross-type generated references', (change) => {
    const bundle = fixture().plan();
    change(bundle);
    expect(ResearchRecordsSchema.safeParse(bundle).success).toBe(false);
  });
});
