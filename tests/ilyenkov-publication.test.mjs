import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { plannedResearchRecords } from '../scripts/lib/research-sync/planner.mjs';
import {
  CircleSchema,
  formatHistoricalPeriod,
  getPublicCircle,
  getPublicLife,
  LifeSchema,
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
  const files = new Set([
    publicationPath,
    ...['timeline', 'works_catalog', 'life', 'circle'].map((key) => publication[key].editorial_path),
  ]);
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

  it.each(['timeline', 'works_catalog', 'life', 'circle'])('requires the %s root selection and manuscript', (key) => {
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
    ['life', 'stages', []],
    ['circle', 'record_ids', []],
  ])('rejects an extra %s selection field %s', (key, field, value) => {
    const input = fixture();
    input.mutate(publicationPath, (manifest) => { manifest[key][field] = value; });
    expect(() => input.plan()).toThrow(/unsupported field/);
  });

  it.each(['timeline', 'works_catalog', 'life', 'circle'])('rejects %s manuscript locators outside web editorial', (key) => {
    const input = fixture();
    input.mutate(publicationPath, (manifest) => { manifest[key].editorial_path = 'research/biography/records.json'; });
    expect(() => input.plan()).toThrow(/editorial_path/);
  });

  it.each(['timeline', 'life', 'circle'])('rejects a %s manuscript symlink outside the editorial directory', (key) => {
    const input = fixture();
    const relative = publication[key].editorial_path;
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
    const birthId = selectedEntries.find((entry) => entry.kind === 'ilyenkov_profile').birth_record_id;
    const activity = selectedEntries.find((entry) => entry.kind === 'biography_event' && entry.public_id !== birthId);
    const work = selectedEntries.find((entry) => entry.kind === 'works_catalog' && entry.work_type_zh === '战时写作');
    input.mutate(publication.life.editorial_path, (manuscript) => {
      for (const stage of manuscript.stages) {
        if (stage.record_ids) stage.record_ids = stage.record_ids.filter((id) => ![activity.public_id, work.public_id].includes(id));
      }
    });
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


const textContent = (html) => html.replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim();
const mainContent = (html) => html.match(/<main>([\s\S]*?)<\/main>/)[1];
const factsWithoutPageSelections = ({ life, circle, ...facts }) => facts;
const bounds = (records) => ({
  start: records.map((record) => record.period.start).sort()[0],
  end: records.map((record) => record.period.end).sort().at(-1),
});

describe('private life and circle publication', () => {
  it('renders private manuscripts and resolves shared facts through generated references', () => {
    const bundle = fixture().plan();
    injected.bundle = bundle;
    const life = getPublicLife();
    const circle = getPublicCircle();
    const lifeText = readJson(researchRoot, publication.life.editorial_path);
    const circleText = readJson(researchRoot, publication.circle.editorial_path);
    for (const field of ['description', 'lead', 'note']) expect(life[field]).toBe(lifeText[field]);
    expect(circle.description).toBe(circleText.description);
    expect(life.stages.map((stage) => stage.title)).toEqual(lifeText.stages.map((stage) => stage.title));
    expect(circle.sections.map((section) => [section.title, section.lead])).toEqual(
      circleText.sections.map((section) => [section.title, section.lead]),
    );
    for (const stage of bundle.life.stages) {
      expect(stage).not.toHaveProperty('records');
      expect(stage).not.toHaveProperty('sources');
    }
    for (const section of bundle.circle.sections) expect(section).not.toHaveProperty('records');
    expect(LifeSchema.safeParse(bundle.life).success).toBe(true);
    expect(CircleSchema.safeParse(bundle.circle).success).toBe(true);

    const lifeMain = mainContent(readFileSync(builtRoutePath('/ilyenkov/life'), 'utf8'));
    const circleMain = mainContent(readFileSync(builtRoutePath('/ilyenkov/circle'), 'utf8'));
    expect([...lifeMain.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map(([, title]) => textContent(title)))
      .toEqual(life.stages.map((stage) => stage.title));
    expect([...circleMain.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map(([, title]) => textContent(title)))
      .toEqual(circle.sections.map((section) => section.title));
    for (const field of ['lead', 'note']) expect(textContent(lifeMain)).toContain(life[field]);
    for (const stage of life.stages) {
      expect(textContent(lifeMain)).toContain(stage.summary);
      if (stage.period) expect(textContent(lifeMain)).toContain(`${stage.period.start.slice(0, 4)}—${stage.period.end.slice(0, 4)}`);
      if (stage.years) expect(textContent(lifeMain)).toContain(stage.years.join('、'));
      for (const link of stage.links) {
        expect(lifeMain).toContain(`href="/ilyenkov/${link.target}"`);
        expect(textContent(lifeMain)).toContain(link.label);
      }
    }
    for (const section of circle.sections) {
      expect(textContent(circleMain)).toContain(section.lead);
      for (const record of section.records) {
        expect(textContent(circleMain)).toContain(record.title);
        expect(textContent(circleMain)).toContain(record.summary);
        expect(textContent(circleMain)).toContain(formatHistoricalPeriod(record.period));
        if (record.location) expect(textContent(circleMain)).toContain(record.location);
        if (record.status) expect(textContent(circleMain)).toContain(record.status);
        for (const source of record.sources) expect(circleMain).toContain(`href="${source.url.replace(/&/g, '&amp;')}"`);
      }
    }
    expect(JSON.stringify(bundle)).not.toMatch(/editorial_path|record_ids|record_kind/);
  });

  it('preserves private stage and section order while deriving ranges from all selected records', () => {
    const input = fixture();
    const before = input.plan();
    const biography = [...before.biography].sort((left, right) => left.period.start.localeCompare(right.period.start));
    const ids = [biography.at(-1).id, biography[0].id, biography[1].id];
    const works = [...before.works].reverse();
    input.mutate(publication.life.editorial_path, (text) => {
      text.stages = [
        { title: 'Works before activities', record_ids: works.map((work) => work.id), summary: 'Private work framing', links: [] },
        { title: 'Activities in editorial order', record_ids: ids, links: [] },
        { title: 'All military records', record_kind: 'military_service', links: [] },
      ];
    });
    input.mutate(publication.circle.editorial_path, (text) => {
      text.sections.reverse();
      for (const section of text.sections) {
        section.title = `Private ${section.record_kind}`;
        section.record_ids = [...before[collectionForKind[section.record_kind]]].reverse().map((record) => record.id);
      }
    });
    input.mutate(publicationPath, (manifest) => { manifest.records.reverse(); });
    const after = input.plan();
    const selectedBiography = ids.map((id) => before.biography.find((record) => record.id === id));
    expect(after.life.stages.map((stage) => stage.title)).toEqual([
      'Works before activities', 'Activities in editorial order', 'All military records',
    ]);
    expect(after.life.stages[0].years).toEqual([...new Set(works.map((work) => work.year))].sort());
    expect(after.life.stages[0]).not.toHaveProperty('period');
    expect(after.life.stages[1].period).toEqual(bounds(selectedBiography));
    expect(after.life.stages[1].recordIds).toEqual(ids);
    expect(after.life.stages[1]).not.toHaveProperty('summary');
    expect(after.life.stages[2].period).toEqual(bounds(before.military));
    expect(after.circle.sections.map((section) => section.title)).toEqual(
      input.read(publication.circle.editorial_path).sections.map((section) => section.title),
    );
    for (const collection of ['biography', 'military', 'congresses', 'works']) {
      expect([...after[collection]].sort((left, right) => left.id.localeCompare(right.id)))
        .toEqual([...before[collection]].sort((left, right) => left.id.localeCompare(right.id)));
    }
    injected.bundle = after;
    expect(getPublicLife().stages[1].summary.replace(/\s/g, '')).toBe(
      selectedBiography.map((record) => record.summary).join('').replace(/\s/g, ''),
    );
    for (const section of getPublicCircle().sections) {
      expect(section.records.every((record, index) => index === 0 || section.records[index - 1].period.start <= record.period.start)).toBe(true);
      for (const record of section.records) {
        const original = before[collectionForKind[section.recordKind]].find((item) => item.id === record.id);
        expect(record).toMatchObject({
          title: original.title, summary: original.summary, period: original.period, sources: original.sources,
          location: original.location ?? null, status: original.status ?? null,
        });
      }
    }
  });

  it('permits empty page selections and empty stage or section references without derived coordinates', () => {
    const input = fixture();
    const before = input.plan();
    input.mutate(publication.life.editorial_path, (text) => {
      text.stages = [{ title: 'Empty stage', record_ids: [], links: [] }];
    });
    input.mutate(publication.circle.editorial_path, (text) => {
      text.sections = [{ title: 'Empty section', lead: 'Private lead', record_kind: 'military_service', record_ids: [] }];
    });
    const selected = input.plan();
    expect(selected.life.stages[0]).toEqual({ title: 'Empty stage', recordIds: [], links: [] });
    expect(selected.circle.sections[0].recordIds).toEqual([]);
    injected.bundle = selected;
    expect(getPublicLife().stages[0].summary).toBe('');
    expect(getPublicCircle().sections[0].records).toEqual([]);
    input.mutate(publication.life.editorial_path, (text) => { text.stages = []; });
    input.mutate(publication.circle.editorial_path, (text) => { text.sections = []; });
    const after = input.plan();
    expect(after.life.stages).toEqual([]);
    expect(after.circle.sections).toEqual([]);
    expect(factsWithoutPageSelections(after)).toEqual(factsWithoutPageSelections(before));
    expect(ResearchRecordsSchema.safeParse(after).success).toBe(true);
  });

  it.each([
    ['life', 'missing lead', (text) => { delete text.lead; }],
    ['life', 'unsupported canonical facts', (text) => { text.events = [{ date: '1924' }]; }],
    ['life', 'both reference selectors', (text) => { text.stages = [{ title: 'Invalid', record_ids: [], record_kind: 'biography_event', links: [] }]; }],
    ['life', 'no reference selector', (text) => { text.stages = [{ title: 'Invalid', links: [] }]; }],
    ['life', 'unsupported reference kind', (text) => { text.stages = [{ title: 'Invalid', record_kind: 'ifi_network', links: [] }]; }],
    ['life', 'duplicate references', (text, bundle) => { text.stages = [{ title: 'Invalid', record_ids: [bundle.biography[0].id, bundle.biography[0].id], links: [] }]; }],
    ['life', 'non-activity public reference', (text, bundle) => { text.stages = [{ title: 'Invalid', record_ids: [bundle.ifiSymposiums[0].id], summary: 'Invalid', links: [] }]; }],
    ['life', 'work without authored summary', (text, bundle) => { text.stages = [{ title: 'Invalid', record_ids: [bundle.works[0].id], links: [] }]; }],
    ['life', 'mixed work and activity references', (text, bundle) => { text.stages = [{ title: 'Invalid', record_ids: [bundle.works[0].id, bundle.biography[0].id], summary: 'Invalid', links: [] }]; }],
    ['life', 'copied period', (text) => { text.stages[0].period = { start: '1924', end: '1941' }; }],
    ['life', 'unsupported link target', (text) => { text.stages[0].links = [{ target: 'archive', label: 'Private URL' }]; }],
    ['life', 'private link field', (text) => { text.stages[0].links = [{ target: 'timeline', label: 'Read more', url: 'private.json' }]; }],
    ['circle', 'missing sections', (text) => { delete text.sections; }],
    ['circle', 'unsupported section kind', (text) => { text.sections = [{ title: 'Invalid', lead: 'Invalid', record_kind: 'biography_event' }]; }],
    ['circle', 'duplicate section kind', (text) => { text.sections.push(structuredClone(text.sections[0])); }],
    ['circle', 'wrong-kind approved reference', (text, bundle) => { text.sections = [{ title: 'Invalid', lead: 'Invalid', record_kind: 'military_service', record_ids: [bundle.congresses[0].id] }]; }],
    ['circle', 'unsupported section source locator', (text) => { text.sections[0].record_path = 'private.json'; }],
  ])('rejects %s manuscript with %s', (key, _reason, change) => {
    const input = fixture();
    const bundle = input.plan();
    input.mutate(publication[key].editorial_path, (text) => change(text, bundle));
    expect(() => input.plan()).toThrow(/life|circle/);
  });

  it.each(['internal_public', 'unauthorized', 'unselected'])('rejects %s references without reading or exporting private facts', (scope) => {
    const input = fixture();
    if (scope !== 'unselected') input.mutate(publicationPath, (manifest) => {
      manifest.records.push({ public_id: 'private-activity', publication_scope: scope, kind: 'biography_event', record_path: 'private/missing.json' });
    });
    input.mutate('research/biography/records.json', (catalog) => {
      catalog.events.push({ event_id: 'private-activity', event_zh: 'UNSELECTED_FACT_SENTINEL' });
    });
    input.mutate(publication.life.editorial_path, (text) => {
      text.stages = [{ title: 'Private reference', record_ids: ['private-activity'], links: [] }];
    });
    expect(() => input.plan()).toThrow(/life.*(?:record|public|approved|reference)/);
    input.mutate(publication.life.editorial_path, (text) => {
      text.stages = [{ title: 'Literal mention', record_ids: [], summary: '{{record:private-activity}}', links: [] }];
    });
    const generated = input.plan();
    expect(generated.life.stages[0].summary).toBe('{{record:private-activity}}');
    expect(JSON.stringify(generated)).not.toContain('UNSELECTED_FACT_SENTINEL');
  });

  it('requires explicit stage edits before an approved referenced record can be withdrawn', () => {
    const input = fixture();
    const birthId = selectedEntries.find((entry) => entry.kind === 'ilyenkov_profile').birth_record_id;
    const id = input.plan().biography.find((record) => record.id !== birthId).id;
    input.mutate(publication.life.editorial_path, (text) => {
      text.stages = [{ title: 'Referenced activity', record_ids: [id], links: [] }];
    });
    input.mutate(publicationPath, (manifest) => {
      manifest.records = manifest.records.filter((entry) => entry.public_id !== id);
    });
    expect(() => input.plan()).toThrow(/life.*(?:record|public|approved|reference)/);
    input.mutate(publication.life.editorial_path, (text) => { text.stages[0].record_ids = []; });
    expect(input.plan().life.stages[0].recordIds).toEqual([]);
  });

  it('cleans withdrawn stage prose, circle sections and references through the actual sync CLI', () => {
    const input = fixture();
    const baseline = input.plan();
    const military = baseline.military.slice(0, 2);
    input.mutate(publication.life.editorial_path, (text) => {
      text.stages = [
        { title: 'Retained stage', record_ids: military.map((record) => record.id), summary: 'WITHDRAWN_SUMMARY_SENTINEL', links: [] },
        { title: 'WITHDRAWN_STAGE_SENTINEL', record_ids: [], links: [] },
      ];
    });
    input.mutate(publication.circle.editorial_path, (text) => {
      text.sections = [
        { title: 'Retained section', lead: 'Private lead', record_kind: 'military_service', record_ids: military.map((record) => record.id) },
        { title: 'WITHDRAWN_SECTION_SENTINEL', lead: 'Withdrawn lead', record_kind: 'hegel_congress' },
      ];
    });
    const first = input.run();
    expect(first.status, first.stderr).toBe(0);
    expect(JSON.stringify(input.generated())).toContain('WITHDRAWN_SUMMARY_SENTINEL');
    input.mutate(publication.life.editorial_path, (text) => {
      text.stages.pop();
      text.stages[0].record_ids = [military[1].id];
      delete text.stages[0].summary;
    });
    input.mutate(publication.circle.editorial_path, (text) => {
      text.sections.pop();
      text.sections[0].record_ids = [military[1].id];
    });
    input.mutate(publicationPath, (manifest) => {
      manifest.records = manifest.records.filter((entry) => entry.public_id !== military[0].id);
    });
    expect(input.run(true).status).toBe(1);
    const second = input.run();
    expect(second.status, second.stderr).toBe(0);
    const generated = input.generated();
    expect(generated.life.stages).toHaveLength(1);
    expect(generated.life.stages[0].recordIds).toEqual([military[1].id]);
    expect(generated.life.stages[0]).not.toHaveProperty('summary');
    expect(generated.life.stages[0].period).toEqual(military[1].period);
    expect(generated.circle.sections).toHaveLength(1);
    expect(generated.circle.sections[0].recordIds).toEqual([military[1].id]);
    expect(JSON.stringify(generated)).not.toMatch(/WITHDRAWN_(?:SUMMARY|STAGE|SECTION)_SENTINEL/);
    expect(JSON.stringify(generated)).not.toContain(military[0].id);
    expect(generated.biography).toEqual(baseline.biography);
    expect(generated.congresses).toEqual(baseline.congresses);
    expect(generated.works).toEqual(baseline.works);
    const checked = input.run(true);
    expect(checked.status, checked.stderr).toBe(0);
    expect(checked.stdout).toContain('stale=0');
    expect(ResearchRecordsSchema.safeParse(generated).success).toBe(true);
  });
});

describe('strict generated life and circle references', () => {
  it.each([
    (bundle) => { bundle.life.stages[0].recordIds = ['not-public']; },
    (bundle) => { bundle.life.stages[0].recordIds = [bundle.ifiSymposiums[0].id]; },
    (bundle) => { bundle.life.stages[0].recordIds.push(bundle.life.stages[0].recordIds[0]); },
    (bundle) => { bundle.life.stages[0].period.start = '1900'; },
    (bundle) => { bundle.life.stages[0].recordIds = []; },
    (bundle) => { bundle.life.stages[0].summary_zh = 'Copied canonical summary'; },
    (bundle) => { bundle.life.stages.find((stage) => stage.years).years.push('1900'); },
    (bundle) => { bundle.circle.sections[0].recordIds = [bundle.biography[0].id]; },
    (bundle) => { bundle.circle.sections[0].recordIds.push(bundle.circle.sections[0].recordIds[0]); },
    (bundle) => { bundle.circle.sections.push(structuredClone(bundle.circle.sections[0])); },
    (bundle) => { bundle.circle.sections[0].editorial_path = 'private.json'; },
  ])('rejects invalid generated references, copied fields and derived coordinates', (change) => {
    const bundle = fixture().plan();
    change(bundle);
    expect(ResearchRecordsSchema.safeParse(bundle).success).toBe(false);
  });
});


describe('selected canonical identities resolve uniquely', () => {
  const catalogs = [
    ['biography_event', 'events', 'event_id'],
    ['military_service', 'timeline', 'event_id'],
    ['hegel_congress', 'events', 'event_id'],
    ['works_catalog', 'works', 'id'],
    ['ifi_network', 'records', 'organization_id'],
    ['ifi_symposium', 'activity_groups', 'event_id'],
    ['ilyenkov_readings', 'conferences', 'local_directory'],
    ['ilyenkov_readings_series', 'records', 'series_id'],
  ];
  it.each(catalogs.flatMap(([kind, collection, key]) => [
    [kind, 0, collection, key], [kind, 2, collection, key],
  ]))('rejects %s identity with %i matches', (kind, count, collection, key) => {
    const input = fixture();
    const entry = selectedEntries.find((entry) => entry.kind === kind);
    const id = entry.record_id ?? entry.record_directory;
    input.mutate(entry.record_path, (catalog) => {
      const record = catalog[collection].find((record) => record[key] === id);
      catalog[collection] = catalog[collection].filter((record) => record[key] !== id);
      for (let index = 0; index < count; index++) catalog[collection].push(structuredClone(record));
    });
    expect(() => input.plan()).toThrow(/exactly one|uniquely/);
  });

  it('does not reject duplicates of an unselected canonical record', () => {
    const input = fixture();
    const before = input.plan();
    const entry = selectedEntries.find((entry) => entry.kind === 'biography_event');
    input.mutate(entry.record_path, (catalog) => {
      const record = { ...catalog.events[0], event_id: 'synthetic-unselected-identity' };
      catalog.events.push(record, structuredClone(record));
    });
    expect(input.plan()).toEqual(before);
  });

  it.each(['source_pages', 'files'])('rejects an ambiguous selected research site %s identity', (collection) => {
    const input = fixture();
    const entry = selectedEntries.find((entry) => entry.kind === 'research_site');
    const selection = entry.sections.find((section) => section.file_path);
    input.mutate(entry.record_path, (catalog) => {
      const record = catalog[collection].find((record) => collection === 'source_pages'
        ? record.page === selection.source_page_url : record.file === selection.file_path);
      catalog[collection].push(structuredClone(record));
    });
    expect(() => input.plan()).toThrow(/source (page|file).*exactly one/);
  });
});


const overviewEntry = (manifest) => manifest.records.find((entry) => entry.kind === 'ilyenkov_profile');

describe('explicit Ilyenkov overview publication', () => {
  it('projects canonical identity and dates into prose and keeps other pages on the shared facts', () => {
    const input = fixture();
    const entry = overviewEntry(input.read(publicationPath));
    const before = input.plan();
    input.mutate(entry.record_path, (registry) => {
      const person = registry.records.find((record) => record.person_id === entry.record_id);
      person.name_original = 'Synthetic canonical name';
      person.death_year = '2000';
      person.private_fact = 'PRIVATE_FACT_SENTINEL';
    });
    const birthSelection = selectedEntries.find((selection) => selection.public_id === entry.birth_record_id);
    input.mutate(birthSelection.record_path, (catalog) => {
      catalog.events.find((record) => record.event_id === birthSelection.record_id).date = '1900-01-02';
    });
    const after = input.plan();
    expect(after.ilyenkov.originalName).toBe('Synthetic canonical name');
    expect(after.ilyenkov.lifespan).toBe('1900—2000');
    expect(after.ilyenkov.introduction.join('')).toContain('Synthetic canonical name，1900—2000');
    expect(JSON.stringify(after.ilyenkov)).not.toMatch(/PRIVATE_FACT_SENTINEL|record_path|editorial_path/);
    expect(after.biography.find((record) => record.id === entry.birth_record_id).period.start).toBe('1900-01-02');
    expect(after.works).toEqual(before.works);
    expect(after.circle).toEqual(before.circle);
  });

  it.each(['internal_public', 'unauthorized', 'unselected'])('does not read or export %s overview editorial', (scope) => {
    const input = fixture();
    const entry = overviewEntry(input.read(publicationPath));
    input.mutate(publicationPath, (manifest) => {
      if (scope === 'unselected') manifest.records = manifest.records.filter((record) => record.kind !== 'ilyenkov_profile');
      else { overviewEntry(manifest).publication_scope = scope; overviewEntry(manifest).record_path = 'private/missing.json'; }
    });
    input.write(entry.editorial_path, { invalid: 'UNSELECTED_MANUSCRIPT_SENTINEL' });
    const output = input.plan();
    expect(output).not.toHaveProperty('ilyenkov');
    expect(JSON.stringify(output)).not.toContain('UNSELECTED_MANUSCRIPT_SENTINEL');
    expect(ResearchRecordsSchema.safeParse(output).success).toBe(true);
  });

  it.each(['missing', 'wrong-type', 'internal_public', 'unselected'])('rejects a %s canonical birth reference without expanding publication scope', (caseName) => {
    const input = fixture();
    const entry = overviewEntry(input.read(publicationPath));
    input.mutate(publicationPath, (manifest) => {
      overviewEntry(manifest).birth_record_id = caseName === 'wrong-type' ? input.plan().works[0].id : 'synthetic-private-birth';
      if (caseName === 'internal_public') manifest.records.push({ public_id: 'synthetic-private-birth',
        publication_scope: 'internal_public', kind: 'biography_event', record_path: 'private/missing.json' });
    });
    expect(() => input.plan()).toThrow(/public birth reference/);
    // Prose placeholders cannot act as arbitrary record lookups either.
    input.mutate(publicationPath, (manifest) => { overviewEntry(manifest).birth_record_id = entry.birth_record_id; });
    input.mutate(entry.editorial_path, (text) => { text.introduction = ['{{record:synthetic-private-birth}}']; });
    expect(() => input.plan()).toThrow(/unsupported introduction reference/);
  });

  it.each([
    (manifest) => { overviewEntry(manifest).editorial_path = 'people/persons.json'; },
    (manifest) => { overviewEntry(manifest).editorial_path = 'web/editorial/missing.json'; },
    (manifest) => { overviewEntry(manifest).record_id = 'person-missing'; },
    (manifest) => { overviewEntry(manifest).lifespan = '1900—2000'; },
    (manifest) => { manifest.records.push({ ...overviewEntry(manifest), public_id: 'duplicate-profile' }); },
  ])('rejects invalid selected identity, manuscript and fact overrides', (mutate) => {
    const input = fixture(); input.mutate(publicationPath, mutate); expect(() => input.plan()).toThrow();
  });

  it('rejects duplicate canonical person identity', () => {
    const input = fixture(); const entry = overviewEntry(input.read(publicationPath));
    input.mutate(entry.record_path, (registry) => registry.records.push(structuredClone(
      registry.records.find((person) => person.person_id === entry.record_id),
    )));
    expect(() => input.plan()).toThrow(/person identity.*found 2/);
  });

  it('cleans withdrawn overview and individual entrances through the actual sync CLI', () => {
    const input = fixture(); const entry = overviewEntry(input.read(publicationPath));
    expect(input.run().status).toBe(0); const before = input.generated();
    input.mutate(entry.editorial_path, (text) => { text.entrances = []; });
    expect(input.run(true).status).toBe(1); expect(input.run().status).toBe(0);
    expect(input.generated().ilyenkov.entrances).toEqual([]);
    input.mutate(publicationPath, (manifest) => { overviewEntry(manifest).publication_scope = 'internal_public'; });
    expect(input.run(true).status).toBe(1); expect(input.run().status).toBe(0);
    delete before.ilyenkov; expect(input.generated()).toEqual(before);
    const check = input.run(true); expect(check.status, check.stderr).toBe(0);
    expect(check.stdout).toContain('written=0 stale=0');
  });
});


describe('strict overview manuscript contract', () => {
  it.each([
    (text) => { text.summary = ''; },
    (text) => { text.introduction = []; },
    (text) => { text.identity = 'Duplicated name'; },
    (text) => { text.lifespan = '1900—2000'; },
    (text) => { text.events = []; },
    (text) => { text.entrances = [{ target: 'private', label: 'Label', summary: 'Summary.' }]; },
    (text) => { text.entrances.push(structuredClone(text.entrances[0])); },
    (text) => { text.entrances[0].css = 'layout'; },
  ])('rejects malformed prose, fact copies, arbitrary targets and layout fields', (change) => {
    const input = fixture(); const entry = overviewEntry(input.read(publicationPath));
    input.mutate(entry.editorial_path, change); expect(() => input.plan()).toThrow();
  });

  it('keeps summary and introduction independently authored without duplicating their consumers', () => {
    const input = fixture(); const entry = overviewEntry(input.read(publicationPath));
    const before = input.plan();
    input.mutate(entry.editorial_path, (text) => { text.summary = 'Synthetic homepage summary.'; });
    const after = input.plan();
    expect(after.ilyenkov.summary).toBe('Synthetic homepage summary.');
    expect(after.ilyenkov.introduction).toEqual(before.ilyenkov.introduction);
    for (const key of Object.keys(before).filter((key) => key !== 'ilyenkov')) expect(after[key]).toEqual(before[key]);
  });
});
