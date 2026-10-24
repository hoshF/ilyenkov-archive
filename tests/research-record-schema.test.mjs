import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { ResearchRecordsSchema } from '../src/lib/research-record.mjs';
import { ResearchRecordsSchema as readerSchema } from '../src/lib/research-records';
import { researchRecordFixture } from './helpers/research-record-fixture.mjs';

const requiredCollections = ['biography', 'military', 'congresses', 'works', 'readings', 'ifiNetworks', 'ifiSymposiums', 'researchers', 'researchSites'];

describe('shared public research output schema', () => {
  it('loads in ordinary Node without the website runtime', () => {
    const moduleUrl = new URL('../src/lib/research-record.mjs', import.meta.url).href;
    expect(execFileSync(process.execPath, ['--input-type=module', '-e',
      `const {ResearchRecordsSchema}=await import(${JSON.stringify(moduleUrl)}); console.log(typeof ResearchRecordsSchema.parse);`,
    ], { encoding: 'utf8' }).trim()).toBe('function');
  });

  it('preserves the reader export and parses a complete fictional output without mutating input', () => {
    expect(readerSchema).toBe(ResearchRecordsSchema);
    const input = researchRecordFixture();
    const bytes = JSON.stringify(input, null, 2);
    const parsed = ResearchRecordsSchema.parse(input);
    expect(parsed).toEqual(input);
    expect(JSON.stringify(input, null, 2)).toBe(bytes);
  });

  // Exercise the whitelist at every nested object, including dynamic type-note maps.
  const objectPaths = [];
  const visit = (value, path = []) => {
    if (Array.isArray(value)) value.forEach((entry, index) => visit(entry, [...path, index]));
    else if (value && typeof value === 'object') {
      if (path.at(-1) !== 'typeNotes') objectPaths.push(path);
      for (const [key, entry] of Object.entries(value)) visit(entry, [...path, key]);
    }
  };
  visit(researchRecordFixture());
  it.each(objectPaths.map((path) => [path.join('.') || '<root>', path]))('rejects extra fields at %s', (_label, path) => {
    const input = researchRecordFixture();
    const object = path.reduce((value, key) => value[key], input);
    object.private_path = 'private/synthetic.json';
    expect(ResearchRecordsSchema.safeParse(input).success).toBe(false);
  });

  it.each(requiredCollections)('requires nonempty %s', (key) => {
    for (const value of [undefined, []]) {
      const input = researchRecordFixture();
      if (value === undefined) delete input[key]; else input[key] = value;
      expect(ResearchRecordsSchema.safeParse(input).success).toBe(false);
    }
  });

  it.each(['timeline', 'worksCatalog', 'life', 'circle'])('requires page root %s', (key) => {
    const input = researchRecordFixture(); delete input[key];
    expect(ResearchRecordsSchema.safeParse(input).success).toBe(false);
  });

  it('allows omitted optional records and editorial, but not an empty selected series', () => {
    const input = researchRecordFixture();
    delete input.readingsSeries; delete input.ilyenkov;
    for (const key of ['ifiNetworks', 'researchers']) delete input[key][0].editorial;
    expect(ResearchRecordsSchema.parse(input)).toEqual(input);
    input.readingsSeries = [];
    expect(ResearchRecordsSchema.safeParse(input).success).toBe(false);
  });

  it('retains empty page selections, references, resources and type notes without defaults', () => {
    const input = researchRecordFixture();
    input.timeline.recordIds = [];
    input.worksCatalog.editorial.typeNotes = {};
    input.life.stages = [{ title: 'Synthetic empty stage', recordIds: [], links: [] }];
    input.circle.sections = [{ recordKind: 'biography_event', title: 'Synthetic empty section', lead: 'Synthetic lead.', recordIds: [] }];
    for (const key of ['readingsSeries', 'ifiNetworks', 'researchers']) input[key][0].resources = [];
    input.ilyenkov.entrances = []; input.ilyenkov.resources = [];
    expect(ResearchRecordsSchema.parse(input)).toEqual(input);
    input.life.stages = []; input.circle.sections = [];
    expect(ResearchRecordsSchema.parse(input)).toEqual(input);
  });

  const invalid = [
    ['timeline unknown record', r => { r.timeline.recordIds = ['not-public']; }],
    ['timeline wrong kind', r => { r.timeline.recordIds = ['synthetic-work']; }],
    ['timeline duplicate reference', r => { r.timeline.recordIds.push('synthetic-birth'); }],
    ['ambiguous activity reference', r => { r.biography.push(structuredClone(r.biography[0])); }],
    ['missing public activity', r => { r.biography[0].id = 'other-birth'; }],
    ['life unknown record', r => { r.life.stages[0].recordIds = ['not-public']; }],
    ['life mixed work and activity', r => { r.life.stages[0].recordIds.push('synthetic-work'); }],
    ['life work without summary', r => { delete r.life.stages[1].summary; }],
    ['life incorrect activity period', r => { r.life.stages[0].period.end = '1930'; }],
    ['life incorrect work years', r => { r.life.stages[1].years = ['1941']; }],
    ['life empty references with coordinates', r => { r.life.stages[0].recordIds = []; }],
    ['life duplicated reference', r => { r.life.stages[0].recordIds.push('synthetic-birth'); }],
    ['circle wrong kind', r => { r.circle.sections[0].recordIds = ['synthetic-service']; }],
    ['circle unknown record', r => { r.circle.sections[0].recordIds = ['not-public']; }],
    ['circle repeated title', r => { r.circle.sections[1].title = r.circle.sections[0].title; }],
    ['circle repeated record across sections', r => { r.circle.sections.push({ ...r.circle.sections[0], title: 'Other title' }); }],
    ['catalog unknown work type', r => { r.worksCatalog.editorial.typeNotes.Unknown = 'Synthetic note.'; }],
    ...['earliestArchivedEventId', 'firstInternationalEventId'].flatMap(key => [
      [`Readings ${key} missing`, r => { r.readingsSeries[0].history[key] = 'not-public'; }],
      [`Readings ${key} wrong kind`, r => { r.readingsSeries[0].history[key] = 'synthetic-work'; }],
    ]),
    ['Readings ambiguous history', r => { r.readings.push(structuredClone(r.readings[0])); }],
    ['IFI missing formation', r => { r.ifiNetworks[0].formation.symposiumId = 'not-public'; }],
    ['IFI wrong formation kind', r => { r.ifiNetworks[0].formation.symposiumId = 'synthetic-reading'; }],
    ['IFI planned formation', r => { r.ifiSymposiums[0].status = 'planned'; }],
    ['IFI ambiguous formation', r => { r.ifiSymposiums.push(structuredClone(r.ifiSymposiums[0])); }],
    ['invalid series type', r => { r.readingsSeries[0].type = 'other'; }],
    ['invalid symposium status', r => { r.ifiSymposiums[0].status = 'other'; }],
    ['invalid symposium format', r => { r.ifiSymposiums[0].format = 'other'; }],
    ['invalid activity mode', r => { r.ifiNetworks[0].activityModes = ['other']; }],
    ['invalid resource kind', r => { r.researchers[0].resources[0].kind = 'other'; }],
    ['duplicate resource kind', r => { r.readingsSeries[0].resources.push({ ...r.readingsSeries[0].resources[0] }); }],
    ['reading both location and format', r => { r.readings[0].location = 'Synthetic city'; }],
    ['reading neither location nor format', r => { r.readings[0].format = null; }],
    ['profile portrait without credit', r => { delete r.ilyenkov.portraitCredit; }],
    ['profile repeated entrance', r => { r.ilyenkov.entrances.push({ ...r.ilyenkov.entrances[0] }); }],
    ['empty introduction', r => { r.researchers[0].editorial.introduction = []; }],
    ['multiline work description', r => { r.researchers[0].editorial.workDescription = 'Synthetic\ntext'; }],
    ['invalid public URL', r => { r.researchSites[0].url = 'file:///synthetic'; }],
  ];
  it.each(invalid)('rejects %s', (_label, mutate) => {
    const input = researchRecordFixture(); mutate(input);
    expect(ResearchRecordsSchema.safeParse(input).success).toBe(false);
  });

  it('keeps the existing acceptance boundaries without adding identity, calendar or HTTPS rules', () => {
    const input = researchRecordFixture();
    input.researchers.push(structuredClone(input.researchers[0]));
    input.researchers[0].name = 'Synthetic\nname';
    input.ilyenkov.resources[0].url = 'http://example.test/profile';
    input.readings[0].period = { start: '2000-02-31', end: '2000-02-31' };
    expect(ResearchRecordsSchema.parse(input)).toEqual(input);
  });
});
