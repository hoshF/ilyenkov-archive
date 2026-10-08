import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { plannedResearchRecords } from '../scripts/lib/research-sync/planner.mjs';
import { ResearcherSchema, ResearchRecordsSchema } from '../src/lib/research-records';
import { researchRoot } from './helpers/publication';

const projectRoot = process.cwd();
const publicationPath = 'web/publication.json';
const personsPath = 'people/persons.json';
const personId = 'person-andrey-maidansky';
const researcherId = 'researcher-andrey-maidansky';
const readJson = (root, relative) => JSON.parse(readFileSync(path.join(root, relative), 'utf8'));
const publication = readJson(researchRoot, publicationPath);
const selectedEntries = publication.records.filter((entry) => entry.publication_scope === 'website_public');
const roots = [];

afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

/** Selected JSON facts are sufficient; this fixture has no Archive files or private text bodies. */
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'ilyenkov-researcher-contract-'));
  roots.push(root);
  const sourceRoot = path.join(root, 'research-source');
  const relativePaths = new Set([publicationPath, personsPath]);
  selectedEntries.forEach((entry) => {
    for (const field of ['record_path', 'source_path', 'editorial_path']) {
      if (entry[field]) relativePaths.add(entry[field]);
    }
  });
  for (const relative of relativePaths) {
    const target = path.join(sourceRoot, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(path.join(researchRoot, relative), 'utf8'));
  }
  return {
    root,
    remove: (relative) => rmSync(path.join(sourceRoot, relative)),
    read: (relative) => readJson(sourceRoot, relative),
    write(relative, data) {
      const target = path.join(sourceRoot, relative);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`);
    },
    mutate(relative, callback) {
      const data = this.read(relative);
      callback(data);
      this.write(relative, data);
    },
    plan: () => plannedResearchRecords({ projectRoot, researchRoot: sourceRoot }),
  };
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
    expect(input.plan().researchers).toEqual([{
      id: researcherId,
      personId,
      name: entry.title_zh,
      originalName: person.name_original,
      latinName: person.name_latin,
      summary: entry.summary_zh,
      roles: person.roles,
      researchFields: person.research_fields,
      resources: entry.resource_kinds.map((kind) => ({ kind, url: person.resources[kind] })),
    }]);
    expect(ResearchRecordsSchema.safeParse(input.plan()).success).toBe(true);
  });

  it('ignores private aliases, positioning, relations, works and future person fields', () => {
    const input = fixture();
    input.mutate(personsPath, (registry) => {
      Object.assign(canonicalPerson(registry), {
        aliases: ['А. Д. Майданский', 'Andrey Maidansky', 'PRIVATE_ALIAS_SENTINEL'],
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
      'id', 'latinName', 'name', 'originalName', 'personId', 'researchFields',
      'resources', 'roles', 'summary',
    ]);
    const serialized = JSON.stringify(researcher);
    expect(serialized).not.toContain('PRIVATE_');
    expect(serialized).not.toContain('А. Д. Майданский');
    expect(serialized).not.toContain('Andrey Maidansky');
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
      Object.assign(researcherEntry(manifest), {
        record_id: 'person-no-public-translations',
        title_zh: '研究者',
        summary_zh: '人物介绍。',
        resource_kinds: [],
      });
    });
    expect(existsSync(path.join(input.root, 'generated', 'articles'))).toBe(false);
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
      researcherEntry(manifest).record_path = 'research/maidansky/works_master.json';
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
      { kind: 'orcid', url: 'https://orcid.org/0000-0003-2061-3878' },
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
      name: '安德烈·迈丹斯基',
      originalName: 'Андрей Дмитриевич Майданский',
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
