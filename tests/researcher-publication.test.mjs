import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { writeGenerated } from '../scripts/lib/sync.mjs';
import { ResearcherSchema, ResearchRecordsSchema } from '../src/lib/research-records';
import {
  researcherFixture, publicationPath, personsPath, personId, researcherId, readJson,
} from './helpers/researcher-publication-fixture.mjs';

const fixtures = [];
afterEach(() => fixtures.splice(0).forEach((input) => input.cleanup()));
function fixture() {
  const input = researcherFixture();
  fixtures.push(input);
  return input;
}

const researcherEntry = (manifest) => manifest.records.find((entry) => entry.public_id === researcherId);
const canonicalPerson = (registry) => registry.records.find((record) => record.person_id === personId);

describe('canonical researcher publication', () => {
  it('requires the web manifest even when both former manifests exist', () => {
    const input = fixture();
    const manifest = input.read(publicationPath);
    input.write('translation/publication.json', { works: manifest.works });
    input.write('research/publication.json', { records: manifest.records });
    input.remove(publicationPath);
    expect(() => input.plan()).toThrow('missing web/publication.json');
  });

  it('ignores internal research selections without reading their private files', () => {
    const input = fixture();
    const before = input.plan();
    input.mutate(publicationPath, (manifest) => {
      manifest.records.push({
        public_id: 'internal-research-record',
        publication_scope: 'internal_public',
        kind: 'biography_event',
        record_path: 'private/missing.json',
      });
    });
    expect(input.plan()).toEqual(before);
    expect(JSON.stringify(input.plan())).not.toContain('internal-research-record');
  });

  it('resolves the published canonical person and keeps Chinese framing in publication', () => {
    const input = fixture();
    const entry = researcherEntry(input.read(publicationPath));
    const person = canonicalPerson(input.read(personsPath));
    expect(input.plan().researchers.find((record) => record.id === researcherId)).toEqual({
      editorial: input.read(entry.editorial_path),
      id: researcherId,
      personId,
      name: entry.title_zh,
      originalName: person.name_original,
      latinName: person.name_latin,
      summary: entry.summary_zh,
      roles: person.roles,
      researchFields: person.research_fields,
      resources: entry.resource_kinds.map((kind) => ({ kind, url: person.resources[kind] })),
    });
    expect(ResearchRecordsSchema.safeParse(input.plan()).success).toBe(true);
  });

  it('ignores private aliases, positioning, relations, works and future person fields', () => {
    const input = fixture();
    input.mutate(personsPath, (registry) => {
      Object.assign(canonicalPerson(registry), {
        aliases: ['Synthetic Alias', 'Synthetic Latin Alias', 'PRIVATE_ALIAS_SENTINEL'],
        positioning_ru: 'PRIVATE_POSITIONING_SENTINEL',
        affiliation: 'PRIVATE_AFFILIATION_SENTINEL',
        local_directory: 'PRIVATE_DIRECTORY_SENTINEL',
        local_id: 'PRIVATE_LOCAL_ID_SENTINEL',
        event_relations: ['PRIVATE_EVENT_SENTINEL'],
        works: ['PRIVATE_WORK_SENTINEL'],
        future_private_fact: 'PRIVATE_FUTURE_SENTINEL',
      });
    });
    const researcher = input.plan().researchers[0];
    expect(Object.keys(researcher).sort()).toEqual([
      'editorial', 'id', 'latinName', 'name', 'originalName', 'personId', 'researchFields',
      'resources', 'roles', 'summary',
    ]);
    const serialized = JSON.stringify(researcher);
    expect(serialized).not.toContain('PRIVATE_');
    expect(serialized).not.toContain('Synthetic Alias');
    expect(serialized).not.toContain('Synthetic Latin Alias');
    expect(serialized).not.toContain(personsPath);
    expect(researcher).not.toHaveProperty('record_path');
    expect(researcher).not.toHaveProperty('record_id');
    expect(researcher).not.toHaveProperty('works');
  });

  it('publishes a person with no Archive articles without requiring selected works', () => {
    const input = fixture();
    input.mutate(personsPath, (registry) => {
      registry.records.push({ person_id: 'person-no-public-translations', name_original: 'A researcher' });
    });
    input.mutate(publicationPath, (manifest) => {
      delete researcherEntry(manifest).editorial_path;
      Object.assign(researcherEntry(manifest), {
        record_id: 'person-no-public-translations',
        title_zh: '研究者',
        summary_zh: '人物介绍。',
        resource_kinds: [],
      });
    });
    expect(existsSync(path.join(input.publicRoot, '.website-input', 'articles'))).toBe(false);
    const researcher = input.plan().researchers[0];
    expect(researcher).toEqual({
      id: researcherId,
      personId: 'person-no-public-translations',
      name: '研究者',
      originalName: 'A researcher',
      summary: '人物介绍。',
      resources: [],
    });
    expect(ResearcherSchema.safeParse(researcher).success).toBe(true);
  });

  it('omits optional person facts when they do not exist', () => {
    const input = fixture();
    input.mutate(personsPath, (registry) => {
      const person = canonicalPerson(registry);
      delete person.name_latin;
      delete person.roles;
      delete person.research_fields;
    });
    const researcher = input.plan().researchers[0];
    expect(researcher).not.toHaveProperty('latinName');
    expect(researcher).not.toHaveProperty('roles');
    expect(researcher).not.toHaveProperty('researchFields');
    expect(ResearcherSchema.safeParse(researcher).success).toBe(true);
  });

  it.each([
    ['missing person ID', publicationPath, (manifest) => { delete researcherEntry(manifest).record_id; }],
    ['blank person ID', publicationPath, (manifest) => { researcherEntry(manifest).record_id = ' '; }],
    ['invalid person ID', publicationPath, (manifest) => { researcherEntry(manifest).record_id = '../private'; }],
    ['unknown person ID', publicationPath, (manifest) => { researcherEntry(manifest).record_id = 'person-unknown'; }],
    ['missing title', publicationPath, (manifest) => { delete researcherEntry(manifest).title_zh; }],
    ['blank title', publicationPath, (manifest) => { researcherEntry(manifest).title_zh = ' '; }],
    ['missing summary', publicationPath, (manifest) => { delete researcherEntry(manifest).summary_zh; }],
    ['blank summary', publicationPath, (manifest) => { researcherEntry(manifest).summary_zh = ' '; }],
    ['missing selected person', personsPath, (registry) => { registry.records = registry.records.filter((person) => person.person_id !== personId); }],
    ['duplicate selected person', personsPath, (registry) => { registry.records.push(structuredClone(canonicalPerson(registry))); }],
    ['malformed registry records', personsPath, (registry) => { registry.records = {}; }],
    ['missing original name', personsPath, (registry) => { delete canonicalPerson(registry).name_original; }],
    ['blank original name', personsPath, (registry) => { canonicalPerson(registry).name_original = ' '; }],
    ['blank Latin name', personsPath, (registry) => { canonicalPerson(registry).name_latin = ''; }],
    ['null Latin name', personsPath, (registry) => { canonicalPerson(registry).name_latin = null; }],
    ['malformed Latin name', personsPath, (registry) => { canonicalPerson(registry).name_latin = []; }],
    ['empty roles', personsPath, (registry) => { canonicalPerson(registry).roles = []; }],
    ['blank role', personsPath, (registry) => { canonicalPerson(registry).roles = [' ']; }],
    ['malformed roles', personsPath, (registry) => { canonicalPerson(registry).roles = 'researcher'; }],
    ['empty research fields', personsPath, (registry) => { canonicalPerson(registry).research_fields = []; }],
    ['non-string research field', personsPath, (registry) => { canonicalPerson(registry).research_fields = [42]; }],
    ['null research fields', personsPath, (registry) => { canonicalPerson(registry).research_fields = null; }],
  ])('rejects %s', (_name, relative, mutate) => {
    const input = fixture();
    input.mutate(relative, mutate);
    expect(() => input.plan()).toThrow();
  });

  it('refuses to read the selected person from an alternative catalog', () => {
    const input = fixture();
    const alternate = 'people/alternative-persons.json';
    input.write(alternate, input.read(personsPath));
    input.mutate(publicationPath, (manifest) => { researcherEntry(manifest).record_path = alternate; });
    expect(() => input.plan()).toThrow(/researcher record_path must use people\/persons.json/);
  });

  it('rejects an old or missing catalog path before trying to read it', () => {
    const input = fixture();
    input.mutate(publicationPath, (manifest) => {
      researcherEntry(manifest).record_path = 'research/fixture/works_master.json';
    });
    expect(() => input.plan()).toThrow(/researcher record_path must use people\/persons.json/);
  });

  it.each([
    'source_path', 'author_zh', 'author_original', 'works', 'include_roles',
    'include_research_fields', 'include_latin_name', 'resources', 'latin_name',
  ])('rejects legacy or override researcher publication field %s without fallback', (field) => {
    const input = fixture();
    input.mutate(publicationPath, (manifest) => { researcherEntry(manifest)[field] = 'PRIVATE_OVERRIDE_SENTINEL'; });
    expect(() => input.plan()).toThrow(/unsupported researcher publication field/);
  });

  it('does not change other research collections when canonical presentation facts change', () => {
    const input = fixture();
    const before = input.plan();
    input.mutate(personsPath, (registry) => {
      Object.assign(canonicalPerson(registry), {
        name_original: 'Changed original name',
        name_latin: 'Changed Latin name',
        roles: ['editor'],
        research_fields: ['A field'],
      });
    });
    const after = input.plan();
    for (const key of Object.keys(before).filter((key) => key !== 'researchers')) {
      expect(after[key], key).toEqual(before[key]);
    }
    expect(after.researchers[0].name).toBe(before.researchers[0].name);
    expect(after.researchers[0].summary).toBe(before.researchers[0].summary);
  });
});

describe('explicit researcher resources', () => {
  it('preserves selected resource order and ignores unselected private resources', () => {
    const input = fixture();
    input.mutate(publicationPath, (manifest) => { researcherEntry(manifest).resource_kinds = ['institution', 'orcid']; });
    input.mutate(personsPath, (registry) => {
      Object.assign(canonicalPerson(registry).resources, {
        institution: 'https://example.org/academic-profile/',
        personal: 'PRIVATE_UNSELECTED_PERSONAL',
        private: 'PRIVATE_UNSELECTED_RESOURCE',
      });
    });
    const researcher = input.plan().researchers[0];
    expect(researcher.resources).toEqual([
      { kind: 'institution', url: 'https://example.org/academic-profile/' },
      { kind: 'orcid', url: 'https://example.test/orcid' },
    ]);
    expect(JSON.stringify(researcher)).not.toContain('PRIVATE_');
  });

  it.each([
    ['unknown resource kind', publicationPath, (manifest) => { researcherEntry(manifest).resource_kinds.push('official'); }],
    ['duplicate resource kind', publicationPath, (manifest) => { researcherEntry(manifest).resource_kinds.push('personal'); }],
    ['missing resource selection', publicationPath, (manifest) => { delete researcherEntry(manifest).resource_kinds; }],
    ['malformed resource selection', publicationPath, (manifest) => { researcherEntry(manifest).resource_kinds = 'personal'; }],
    ['missing selected resource', personsPath, (registry) => { delete canonicalPerson(registry).resources.personal; }],
    ['missing resources', personsPath, (registry) => { delete canonicalPerson(registry).resources; }],
    ['malformed resources', personsPath, (registry) => { canonicalPerson(registry).resources = []; }],
    ['invalid selected URL', personsPath, (registry) => { canonicalPerson(registry).resources.personal = 'file:///private/person'; }],
    ['blank selected URL', personsPath, (registry) => { canonicalPerson(registry).resources.personal = ' '; }],
  ])('rejects %s', (_name, relative, mutate) => {
    const input = fixture();
    input.mutate(relative, mutate);
    expect(() => input.plan()).toThrow();
  });
});

describe('strict public researcher schema', () => {
  it('accepts a canonical identity with no works or optional facts', () => {
    expect(ResearcherSchema.safeParse({
      id: researcherId,
      personId,
      name: '虚构研究者',
      originalName: 'Synthetic Researcher',
      summary: '人物介绍。',
      resources: [],
    }).success).toBe(true);
  });

  it.each([
    ['missing person ID', (record) => { delete record.personId; }],
    ['invalid person ID', (record) => { record.personId = '../private'; }],
    ['blank Latin name', (record) => { record.latinName = ' '; }],
    ['blank role', (record) => { record.roles = [' ']; }],
    ['empty roles', (record) => { record.roles = []; }],
    ['blank research field', (record) => { record.researchFields = [' ']; }],
    ['empty research fields', (record) => { record.researchFields = []; }],
    ['legacy works', (record) => { record.works = []; }],
    ['aliases', (record) => { record.aliases = ['private']; }],
    ['private positioning', (record) => { record.positioning_ru = 'private'; }],
    ['private record path', (record) => { record.record_path = personsPath; }],
    ['private record ID', (record) => { record.record_id = personId; }],
    ['unknown resource kind', (record) => { record.resources[0].kind = 'official'; }],
    ['duplicate resource kind', (record) => { record.resources.push(structuredClone(record.resources[0])); }],
    ['invalid resource URL', (record) => { record.resources[0].url = 'ftp://example.org'; }],
    ['resource label', (record) => { record.resources[0].label = '学术页'; }],
  ])('rejects %s in generated researcher data', (_name, mutate) => {
    const record = fixture().plan().researchers[0];
    mutate(record);
    expect(ResearcherSchema.safeParse(record).success).toBe(false);
  });
});


describe('explicit researcher editorial selection', () => {
  it('projects only selected manuscript fields and removes withdrawn prose from generated input', () => {
    const input = fixture();
    const entry = researcherEntry(input.read(publicationPath));
    input.write(entry.editorial_path, { introduction: ['Synthetic introduction.'], workDescription: 'Synthetic research description.' });
    const target = path.join(input.root, 'generated', 'research-records.json');
    const sync = (checkOnly = false) => writeGenerated(target, `${JSON.stringify(input.plan())}\n`, { checkOnly });
    expect(sync()).toBe(true);
    expect(input.plan().researchers[0].editorial).toEqual(input.read(entry.editorial_path));
    expect(JSON.stringify(input.plan())).not.toContain(entry.editorial_path);
    input.mutate(publicationPath, (manifest) => { delete researcherEntry(manifest).editorial_path; });
    input.write(entry.editorial_path, { invalid: 'Unselected manuscript must not be read.' });
    expect(sync(true)).toBe(true);
    expect(sync()).toBe(true);
    expect(sync(true)).toBe(false);
    expect(readJson(path.dirname(target), path.basename(target)).researchers[0]).not.toHaveProperty('editorial');
    expect(readFileSync(target, 'utf8')).not.toContain('Synthetic introduction.');
  });

  it.each(['internal_public', 'unauthorized'])('does not read %s researcher editorial or its canonical person', (scope) => {
    const input = fixture();
    const before = input.plan();
    input.mutate(publicationPath, (manifest) => {
      manifest.records.push({ public_id: 'researcher-private', publication_scope: scope,
        kind: 'researcher_profile', record_path: 'private/missing.json',
        record_id: 'person-private', editorial_path: 'web/editorial/missing.json' });
    });
    expect(input.plan()).toEqual(before);
  });

  it('does not interpret prose references as publication selections', () => {
    const input = fixture();
    const entry = researcherEntry(input.read(publicationPath));
    const before = input.plan();
    input.mutate(personsPath, (registry) => {
      registry.records.push({ person_id: 'person-unpublished', name_original: 'PRIVATE_PERSON_SENTINEL' });
    });
    input.write(entry.editorial_path, { introduction: ['person-unpublished: research/private/missing.json'], workDescription: 'Synthetic description.' });
    const after = input.plan();
    expect(after.researchers.map((record) => record.personId)).toEqual(before.researchers.map((record) => record.personId));
    expect(JSON.stringify(after)).not.toContain('PRIVATE_PERSON_SENTINEL');
    for (const key of Object.keys(before).filter((key) => key !== 'researchers')) expect(after[key]).toEqual(before[key]);
  });

  it.each(['', null, '../private.json', 'people/persons.json', 'web/editorial/missing.json'])('rejects invalid or dangling manuscript path %j', (editorialPath) => {
    const input = fixture();
    input.mutate(publicationPath, (manifest) => { researcherEntry(manifest).editorial_path = editorialPath; });
    expect(() => input.plan()).toThrow();
  });

  it.each([
    { introduction: [], workDescription: 'Description.' },
    { introduction: [' '], workDescription: 'Description.' },
    { introduction: ['Introduction.'] },
    { introduction: ['Introduction.'], workDescription: ' ' },
    { introduction: ['Introduction.'], workDescription: 'Two\nlines' },
    { introduction: ['Introduction.'], workDescription: 'Description.', personId: 'person-private' },
    { introduction: ['Introduction.'], workDescription: 'Description.', works: [] },
  ])('rejects malformed prose or structured reference overrides %j', (manuscript) => {
    const input = fixture();
    const entry = researcherEntry(input.read(publicationPath));
    input.write(entry.editorial_path, manuscript);
    expect(() => input.plan()).toThrow();
    expect(ResearcherSchema.safeParse({ ...fixture().plan().researchers[0], editorial: manuscript }).success).toBe(false);
  });
});


it('cleans withdrawn researcher editorial through the actual sync CLI without changing articles or other records', () => {
  const input = fixture();
  const article = path.join(input.publicRoot, '.website-input/articles/fixture-article.md');
  mkdirSync(path.dirname(article), { recursive: true });
  writeFileSync(article, 'Synthetic article preserved by research sync.');
  const first = input.run();
  expect(first.status, first.stderr).toBe(0);
  const before = input.generated();
  input.mutate(publicationPath, (manifest) => { delete researcherEntry(manifest).editorial_path; });
  expect(input.run(true).status).toBe(1);
  const second = input.run();
  expect(second.status, second.stderr).toBe(0);
  delete before.researchers[0].editorial;
  expect(input.generated()).toEqual(before);
  const check = input.run(true);
  expect(check.status, check.stderr).toBe(0);
  expect(check.stdout).toContain('written=0 stale=0');
  expect(readFileSync(article, 'utf8')).toBe('Synthetic article preserved by research sync.');
});

it('withdraws a researcher through the real CLI without reading its former person or manuscript', () => {
  const input = fixture();
  const first = input.run();
  expect(first.status, first.stderr).toBe(0);
  const before = input.generated();
  input.mutate(publicationPath, (manifest) => {
    manifest.records = manifest.records.filter((entry) => entry.public_id !== researcherId);
  });
  input.mutate(personsPath, (registry) => {
    registry.records = registry.records.filter((person) => person.person_id !== personId);
  });
  input.write('web/editorial/fixture-researcher.json', { invalid: 'Withdrawn manuscript must not be read.' });
  expect(input.run(true).status).toBe(1);
  expect(input.generated()).toEqual(before);
  const written = input.run();
  expect(written.status, written.stderr).toBe(0);
  expect(input.generated()).toEqual({ ...before,
    researchers: before.researchers.filter((researcher) => researcher.id !== researcherId),
  });
  expect(ResearchRecordsSchema.safeParse(input.generated()).success).toBe(true);
  expect(input.run(true).status).toBe(0);
});

describe('explicit researcher portrait selection', () => {
  const portraitPath = 'people/fixture/portrait.jpeg';
  const portraitBytes = Buffer.from('PORTRAIT_FIXTURE_BYTES');
  const selectPortrait = (input, relative = portraitPath) => {
    input.mutate(publicationPath, (manifest) => { researcherEntry(manifest).portrait_path = relative; });
  };

  const researcherPortraits = (portraits) => [...portraits.keys()].filter((name) => name.startsWith('researcher-'));

  it('publishes no researcher portrait unless the researcher entry selects one', () => {
    const input = fixture();
    const { records, portraits } = input.outputs();
    const unselected = new Set(input.read(publicationPath).records
      .filter((entry) => entry.kind === 'researcher_profile' && !entry.portrait_path)
      .map((entry) => entry.public_id));
    const researchers = records.researchers.filter((researcher) => unselected.has(researcher.id));
    expect(unselected.size).toBeGreaterThan(0);
    expect(researchers).toHaveLength(unselected.size);
    expect(researchers.every((researcher) => !Object.hasOwn(researcher, 'portrait'))).toBe(true);
    expect(researcherPortraits(portraits).filter((name) => unselected.has(name.replace(/\.[a-z]+$/, '')))).toEqual([]);
  });

  it('names the selected portrait by public ID and keeps the private path out of generated data', () => {
    const input = fixture();
    input.writeBytes(portraitPath, portraitBytes);
    selectPortrait(input);
    const { records, portraits } = input.outputs();
    const researcher = records.researchers.find((record) => record.id === researcherId);
    expect(researcher.portrait).toBe(`${researcherId}.jpg`);
    expect(researcherPortraits(portraits)).toContain(`${researcherId}.jpg`);
    expect(readFileSync(portraits.get(`${researcherId}.jpg`))).toEqual(portraitBytes);
    expect(JSON.stringify(records)).not.toContain(portraitPath);
    expect(ResearcherSchema.safeParse(researcher).success).toBe(true);
  });

  it.each([
    ['research/fixture/portrait.jpg', /under people\//],
    ['people/fixture/portrait.gif', /under people\//],
    ['people/portrait.jpg', /under people\//],
    ['people/fixture/../../web/portrait.jpg', /under people\//],
    ['people/fixture/missing.jpg', /missing people\/fixture\/missing.jpg/],
  ])('rejects portrait_path %s', (relative, message) => {
    const input = fixture();
    selectPortrait(input, relative);
    expect(() => input.plan()).toThrow(message);
  });

  it('rejects a selected portrait that links outside people', () => {
    const input = fixture();
    input.writeBytes('web/outside.jpg', portraitBytes);
    const link = path.join(input.root, 'research-source', 'people', 'fixture', 'linked.jpg');
    mkdirSync(path.dirname(link), { recursive: true });
    symlinkSync(path.join(input.root, 'research-source', 'web', 'outside.jpg'), link);
    selectPortrait(input, 'people/fixture/linked.jpg');
    expect(() => input.plan()).toThrow(/portrait_path escapes people/);
  });

  it('copies the selected portrait through the sync CLI and removes it when the selection is withdrawn', () => {
    const input = fixture();
    input.writeBytes(portraitPath, portraitBytes);
    selectPortrait(input);
    const first = input.run();
    expect(first.status, first.stderr).toBe(0);
    const generated = input.generatedPortrait(`${researcherId}.jpg`);
    expect(readFileSync(generated)).toEqual(portraitBytes);
    expect(input.run(true).stdout).toContain('written=0 stale=0');

    input.mutate(publicationPath, (manifest) => { delete researcherEntry(manifest).portrait_path; });
    expect(input.run(true).status).toBe(1);
    expect(existsSync(generated)).toBe(true);
    const second = input.run();
    expect(second.status, second.stderr).toBe(0);
    expect(existsSync(generated)).toBe(false);
    expect(input.generated().researchers.some((researcher) => Object.hasOwn(researcher, 'portrait'))).toBe(false);
    expect(input.run(true).stdout).toContain('written=0 stale=0');
  });
});
