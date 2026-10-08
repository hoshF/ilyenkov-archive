import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { plannedResearchRecords } from '../scripts/lib/research-sync/planner.mjs';
import { getPublicReadingsSeries, ReadingsSeriesSchema, ResearchRecordsSchema } from '../src/lib/research-records';
import { builtRoutePath, routeExists } from './helpers/pages';
import { researchRoot } from './helpers/publication';

const projectRoot = process.cwd();
const publicationPath = 'web/publication.json';
const eventsPath = 'research/readings/events.json';
const seriesPath = 'research/readings/series.json';
const editorialPath = 'web/editorial/readings.json';
const earliestDirectory = 'events/1991-unnumbered-first-readings';
const firstInternationalDirectory = 'events/1999-I-first-international';
const unnumbered1997Directory = 'events/1997-unnumbered-mgap';
const edition2011Directory = 'events/2011-XIII-philosophy-and-culture';
const memorial2011Directory = 'events/2011-03-memorial-conference-thinking-and-activity';
const resourceKinds = ['archive', 'society', 'historical_archive'];
const readJson = (root, relative) => JSON.parse(readFileSync(path.join(root, relative), 'utf8'));
const publication = readJson(researchRoot, publicationPath);
const selectedEntries = publication.records.filter((entry) => entry.publication_scope === 'website_public');
const selectedReadings = selectedEntries.filter((entry) => entry.kind === 'ilyenkov_readings');
const earliestPublicId = 'readings-1991-first';
const firstInternationalPublicId = 'readings-1999-i-first-international';
const privateSeries = readJson(researchRoot, seriesPath).records.find((record) => (
  record.series_id === 'ilyenkov-readings-series'
));
const roots = [];

afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

/** Fixtures contain selected JSON facts, never research bodies. */
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'ilyenkov-readings-contract-'));
  roots.push(root);
  const sourceRoot = path.join(root, 'research-source');
  const outputRoot = path.join(root, 'generated');
  const relativePaths = new Set([
    publicationPath, eventsPath, seriesPath,
    ...[firstInternationalDirectory, unnumbered1997Directory, edition2011Directory, memorial2011Directory].map((directory) => (
      `research/readings/${directory}/sources.json`
    )),
  ]);
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
    plan: () => plannedResearchRecords({ projectRoot, researchRoot: sourceRoot, outputRoot }),
  };
}

const readingEntry = (manifest, publicId = earliestPublicId) => manifest.records.find((entry) => (
  entry.kind === 'ilyenkov_readings' && entry.public_id === publicId
));
const seriesEntry = (manifest) => manifest.records.find((entry) => entry.kind === 'ilyenkov_readings_series');
const seriesRecord = (catalog) => catalog.records.find((record) => record.series_id === privateSeries.series_id);
const conference = (catalog, directory) => catalog.conferences.find((record) => record.local_directory === directory);

/** Add an explicitly unselected event only; selected baseline records are mutated in place. */
function addReading(input, directory, publicId) {
  const event = conference(input.read(eventsPath), directory);
  const sourceIds = directory === unnumbered1997Directory ? ['src-1997-006']
    : directory === edition2011Directory ? ['src-2011-001'] : ['src-2011-03-001'];
  const entry = {
    public_id: publicId,
    publication_scope: 'website_public',
    kind: 'ilyenkov_readings',
    record_path: eventsPath,
    record_directory: directory,
    source_path: `research/readings/${directory}/sources.json`,
    edition_zh: directory === unnumbered1997Directory ? '未编号' : '第十三届',
    title_zh: event.title_zh,
    location_zh: directory === unnumbered1997Directory ? '莫斯科' : '阿斯塔纳',
    source_ids: sourceIds,
  };
  input.mutate(publicationPath, (manifest) => {
    expect(manifest.records.some((record) => record.kind === 'ilyenkov_readings'
      && record.record_directory === directory)).toBe(false);
    manifest.records.push(entry);
  });
  return entry;
}

describe('Readings directory publication locator', () => {
  it('resolves the selected 1999 first international edition using only directory identity', () => {
    const input = fixture();
    const entry = readingEntry(input.read(publicationPath), firstInternationalPublicId);
    const reading = input.plan().readings.find((record) => record.id === entry.public_id);
    const event = conference(input.read(eventsPath), firstInternationalDirectory);
    expect(reading.title).toBe(entry.title_zh);
    expect(reading.period).toEqual({ start: event.start_date, end: event.end_date });
    expect(reading.edition).toBe(entry.edition_zh);
    expect(event.edition_roman).toBe('I');
    expect(reading).not.toHaveProperty('local_directory');
    expect(reading).not.toHaveProperty('record_directory');
    expect(ResearchRecordsSchema.safeParse(input.plan()).success).toBe(true);
  });

  it('rejects record_id alongside a valid directory instead of supporting two locators', () => {
    const input = fixture();
    input.mutate(publicationPath, (manifest) => {
      readingEntry(manifest).record_id = '1991';
    });
    expect(() => input.plan()).toThrow(/record_id/);
  });

  it('requires record_directory even for a previously selected public event', () => {
    const input = fixture();
    input.mutate(publicationPath, (manifest) => { delete readingEntry(manifest).record_directory; });
    expect(() => input.plan()).toThrow(/record_directory/);
  });

  it('rejects a year-only record_id for a previously selected public event', () => {
    const input = fixture();
    input.mutate(publicationPath, (manifest) => {
      const entry = readingEntry(manifest);
      delete entry.record_directory;
      entry.record_id = '1991';
    });
    expect(() => input.plan()).toThrow(/record_directory|record_id/);
  });

  it('selects the 2011 edition even when the same-year memorial is first in the catalog', () => {
    const input = fixture();
    addReading(input, edition2011Directory, 'fixture-2011-edition');
    input.mutate(eventsPath, (catalog) => {
      const memorial = conference(catalog, memorial2011Directory);
      catalog.conferences = [memorial, ...catalog.conferences.filter((event) => event !== memorial)];
    });
    const reading = input.plan().readings.find((record) => record.id === 'fixture-2011-edition');
    expect(reading.title).toBe('哲学与文化');
    expect(reading.period).toEqual({ start: '2011-05-12', end: '2011-05-13' });
    expect(reading.location).toBe('阿斯塔纳');
  });

  it('rejects the separate 2011 memorial even when its sources support title and dates', () => {
    const input = fixture();
    addReading(input, memorial2011Directory, 'fixture-memorial');
    expect(() => input.plan()).toThrow(/not a Readings edition/);
  });

  it.each(['', '   ', null, 1991, []])('rejects an invalid required directory %j', (directory) => {
    const input = fixture();
    input.mutate(publicationPath, (manifest) => { readingEntry(manifest).record_directory = directory; });
    expect(() => input.plan()).toThrow(/record_directory/);
  });

  it('rejects a directory missing from the catalog', () => {
    const input = fixture();
    input.mutate(publicationPath, (manifest) => {
      readingEntry(manifest).record_directory = 'events/not-an-archived-reading';
    });
    expect(() => input.plan()).toThrow(/directory must match exactly one event/);
  });

  it('rejects an ambiguous directory instead of taking the first matching event', () => {
    const input = fixture();
    input.mutate(eventsPath, (catalog) => {
      catalog.conferences.push(structuredClone(conference(catalog, firstInternationalDirectory)));
    });
    expect(() => input.plan()).toThrow(/directory must match exactly one event/);
  });

  it('requires the selected source path to belong to the located edition', () => {
    const input = fixture();
    input.mutate(publicationPath, (manifest) => {
      const earliest = readingEntry(manifest);
      const entry = readingEntry(manifest, firstInternationalPublicId);
      entry.source_path = earliest.source_path;
      entry.source_ids = [...earliest.source_ids];
    });
    expect(() => input.plan()).toThrow(/selected source path is not the Readings event source directory/);
  });

  it.each(['not_applicable', '', null, 'one'])('rejects a non-edition identity %j', (edition) => {
    const input = fixture();
    input.mutate(eventsPath, (catalog) => {
      conference(catalog, firstInternationalDirectory).edition_roman = edition;
    });
    expect(() => input.plan()).toThrow(/not a Readings edition|edition_roman/);
  });

  it('accepts other archived unnumbered editions without treating them as the earliest series relation', () => {
    const input = fixture();
    addReading(input, unnumbered1997Directory, 'fixture-1997-unnumbered');
    const record = input.plan().readings.find((reading) => reading.id === 'fixture-1997-unnumbered');
    expect(record.title).toBe('1997 年伊里因科夫学术报告会');
    expect(record.period).toEqual({ start: '1997-02-18', end: '1997-02-19' });
    input.mutate(seriesPath, (catalog) => {
      seriesRecord(catalog).earliest_archived_event_directory = unnumbered1997Directory;
    });
    expect(() => input.plan()).toThrow();
  });

  it('uses directory identity when other archived events share the selected year', () => {
    const input = fixture();
    const before = input.plan();
    input.mutate(eventsPath, (catalog) => {
      catalog.conferences.push({
        ...conference(catalog, earliestDirectory),
        local_directory: 'events/another-1991-record',
      });
    });
    expect(input.plan()).toEqual(before);
  });

  it('requires the canonical Readings catalog for directory selection', () => {
    const input = fixture();
    const alternate = 'research/readings/other-events.json';
    input.write(alternate, input.read(eventsPath));
    input.mutate(publicationPath, (manifest) => { readingEntry(manifest).record_path = alternate; });
    expect(() => input.plan()).toThrow(/Readings record_path/);
  });

  it('rejects a duplicate directory even when the duplicated record declares a different year', () => {
    const input = fixture();
    input.mutate(eventsPath, (catalog) => {
      catalog.conferences.push({ ...conference(catalog, earliestDirectory), year: 1990 });
    });
    expect(() => input.plan()).toThrow(/directory must match exactly one event/);
  });
});

describe('Readings series publication adapter', () => {
  it('maps the selected series directories to public event IDs regardless of publication order', () => {
    const input = fixture();
    input.mutate(publicationPath, (manifest) => {
      const entry = seriesEntry(manifest);
      manifest.records = [entry, ...manifest.records.filter((record) => record !== entry)];
    });
    const records = input.plan();
    const series = records.readingsSeries[0];
    const entry = seriesEntry(input.read(publicationPath));
    expect(series).toEqual({
      id: entry.public_id,
      title: entry.title_zh,
      name: privateSeries.name_ru,
      summary: entry.summary_zh,
      editorial: input.read(entry.editorial_path),
      type: 'academic_conference_series',
      history: {
        earliestArchivedEventId: earliestPublicId,
        firstInternationalEventId: firstInternationalPublicId,
      },
      resources: resourceKinds.map((kind) => ({ kind, url: privateSeries.resources[kind] })),
    });
    expect(ResearchRecordsSchema.safeParse(records).success).toBe(true);
    expect(records.readings.some((record) => record.id === series.history.earliestArchivedEventId)).toBe(true);
    expect(records.readings.some((record) => record.id === series.history.firstInternationalEventId)).toBe(true);
  });

  it('uses the selected publication public ID rather than a directory or private series identity', () => {
    const input = fixture();
    const publicId = 'public-earliest-archived-reading';
    input.mutate(publicationPath, (manifest) => {
      const entry = readingEntry(manifest);
      entry.record_directory = earliestDirectory;
      entry.public_id = publicId;
      seriesEntry(manifest).public_id = 'public-readings-series';
    });
    const series = input.plan().readingsSeries[0];
    expect(series.history.earliestArchivedEventId).toBe(publicId);
    expect(series.id).toBe('public-readings-series');
    expect(JSON.stringify(series)).not.toContain('events/');
  });

  it('does not publish private series summaries, directories or newly added private fields', () => {
    const input = fixture();
    input.mutate(seriesPath, (catalog) => {
      Object.assign(seriesRecord(catalog), {
        positioning_ru: 'PRIVATE_POSITIONING_SENTINEL',
        memorial_background_ru: 'PRIVATE_MEMORIAL_SENTINEL',
        continuity_summary_ru: 'PRIVATE_CONTINUITY_SENTINEL',
        event_ids: ['PRIVATE_EVENT_SENTINEL'],
        organizers: ['PRIVATE_ORGANIZER_SENTINEL'],
        reports: ['PRIVATE_REPORT_SENTINEL'],
        publications: ['PRIVATE_PUBLICATION_SENTINEL'],
        media: ['PRIVATE_MEDIA_SENTINEL'],
        transcript: 'PRIVATE_TRANSCRIPT_SENTINEL',
        internal_notes: 'PRIVATE_NOTES_SENTINEL',
      });
    });
    const series = input.plan().readingsSeries[0];
    expect(Object.keys(series).sort()).toEqual(['editorial', 'history', 'id', 'name', 'resources', 'summary', 'title', 'type']);
    expect(Object.keys(series.history).sort()).toEqual(['earliestArchivedEventId', 'firstInternationalEventId']);
    expect(JSON.stringify(series)).not.toContain('PRIVATE_');
    expect(JSON.stringify(series)).not.toContain('events/');
  });

  it('fails if series publication is enabled before the first international event is public', () => {
    const input = fixture();
    input.mutate(publicationPath, (manifest) => {
      manifest.records = manifest.records.filter((entry) => entry.public_id !== firstInternationalPublicId);
    });
    expect(() => input.plan()).toThrow(/first_international_event_directory requires a unique website_public Readings publication/);
  });

  it.each([
    ['missing selected series', (catalog) => { catalog.records = []; }],
    ['duplicate selected series', (catalog) => { catalog.records.push(structuredClone(seriesRecord(catalog))); }],
    ['missing Russian name', (catalog) => { delete seriesRecord(catalog).name_ru; }],
    ['blank Russian name', (catalog) => { seriesRecord(catalog).name_ru = ' '; }],
    ['wrong fixed type', (catalog) => { seriesRecord(catalog).type = 'research_network'; }],
    ['missing earliest directory', (catalog) => { delete seriesRecord(catalog).earliest_archived_event_directory; }],
    ['blank earliest directory', (catalog) => { seriesRecord(catalog).earliest_archived_event_directory = ''; }],
    ['missing first international directory', (catalog) => { delete seriesRecord(catalog).first_international_event_directory; }],
    ['blank first international directory', (catalog) => { seriesRecord(catalog).first_international_event_directory = ' '; }],
    ['malformed resources', (catalog) => { seriesRecord(catalog).resources = []; }],
  ])('rejects a private series record with %s', (_name, mutate) => {
    const input = fixture();
    input.mutate(seriesPath, mutate);
    expect(() => input.plan()).toThrow();
  });

  it.each([
    ['earliest event absent', (catalog) => {
      catalog.conferences = catalog.conferences.filter((event) => event.local_directory !== earliestDirectory);
    }],
    ['earliest directory duplicated', (catalog) => {
      catalog.conferences.push(structuredClone(conference(catalog, earliestDirectory)));
    }],
    ['earliest event outside 1991', (catalog) => { conference(catalog, earliestDirectory).year = 1992; }],
    ['earliest event numbered', (catalog) => { conference(catalog, earliestDirectory).edition_roman = 'I'; }],
    ['first international event absent', (catalog) => {
      catalog.conferences = catalog.conferences.filter((event) => event.local_directory !== firstInternationalDirectory);
    }],
    ['first international directory duplicated', (catalog) => {
      catalog.conferences.push(structuredClone(conference(catalog, firstInternationalDirectory)));
    }],
    ['first international event not I', (catalog) => { conference(catalog, firstInternationalDirectory).edition_roman = 'II'; }],
  ])('rejects an invalid history relation: %s', (_name, mutate) => {
    const input = fixture();
    input.mutate(eventsPath, mutate);
    expect(() => input.plan()).toThrow();
  });

  it.each([
    ['numbered event as earliest history', 'earliest_archived_event_directory', firstInternationalDirectory],
    ['unnumbered event as first international history', 'first_international_event_directory', earliestDirectory],
    ['memorial as first international history', 'first_international_event_directory', memorial2011Directory],
  ])('rejects %s', (_name, field, directory) => {
    const input = fixture();
    input.mutate(seriesPath, (catalog) => { seriesRecord(catalog)[field] = directory; });
    expect(() => input.plan()).toThrow();
  });

  it.each(['private_research', 'metadata_only', 'restricted_study'])('requires relation publications to be website_public, not %s', (scope) => {
    const input = fixture();
    input.mutate(publicationPath, (manifest) => {
      readingEntry(manifest, firstInternationalPublicId).publication_scope = scope;
    });
    expect(() => input.plan()).toThrow();
  });

  it('rejects multiple public publications of the same relation event even when public IDs differ', () => {
    const input = fixture();
    input.mutate(publicationPath, (manifest) => {
      manifest.records.push({ ...structuredClone(readingEntry(manifest, firstInternationalPublicId)), public_id: 'second-public-first-event' });
    });
    expect(() => input.plan()).toThrow(/first_international_event_directory requires a unique website_public Readings publication/);
  });

  it('does not resolve a relation through a publication of another kind', () => {
    const input = fixture();
    input.mutate(publicationPath, (manifest) => {
      const unrelated = structuredClone(manifest.records.find((entry) => entry.kind === 'biography_event'));
      unrelated.public_id = firstInternationalPublicId;
      manifest.records = manifest.records.map((entry) => entry.public_id === firstInternationalPublicId ? unrelated : entry);
    });
    expect(() => input.plan()).toThrow(/first_international_event_directory requires a unique website_public Readings publication/);
  });

  it('reads series facts only from the canonical series catalog', () => {
    const input = fixture();
    const alternate = 'research/readings/another-series.json';
    input.write(alternate, input.read(seriesPath));
    input.mutate(publicationPath, (manifest) => { seriesEntry(manifest).record_path = alternate; });
    expect(() => input.plan()).toThrow();
  });

  it('leaves every other collection unchanged when only private series presentation facts change', () => {
    const input = fixture();
    const before = input.plan();
    input.mutate(seriesPath, (catalog) => {
      seriesRecord(catalog).name_ru = 'Изменённое имя серии';
      seriesRecord(catalog).resources.archive = 'https://example.org/selected-series-archive/';
    });
    const after = input.plan();
    for (const key of Object.keys(before).filter((key) => key !== 'readingsSeries')) {
      expect(after[key], key).toEqual(before[key]);
    }
  });
});

describe('selected Readings series resources', () => {
  it('retains publication selection order and reads URLs only from private series resources', () => {
    const input = fixture();
    input.mutate(publicationPath, (manifest) => { seriesEntry(manifest).resource_kinds = ['historical_archive', 'archive']; });
    input.mutate(seriesPath, (catalog) => {
      const record = seriesRecord(catalog);
      record.resources.historical_archive = 'http://example.org/history/';
      record.resources.archive = 'https://example.org/archive/';
      record.resources.society = 'https://example.org/UNSELECTED_SOCIETY/';
      record.resources.internal = 'PRIVATE_UNSELECTED_RESOURCE';
    });
    const resources = input.plan().readingsSeries[0].resources;
    expect(resources).toEqual([
      { kind: 'historical_archive', url: 'http://example.org/history/' },
      { kind: 'archive', url: 'https://example.org/archive/' },
    ]);
    expect(resources.every((resource) => Object.keys(resource).sort().join(',') === 'kind,url')).toBe(true);
    expect(JSON.stringify(resources)).not.toContain('UNSELECTED');
  });

  it('allows explicit empty selection without publishing any series resources', () => {
    const input = fixture();
    input.mutate(publicationPath, (manifest) => { seriesEntry(manifest).resource_kinds = []; });
    expect(input.plan().readingsSeries[0].resources).toEqual([]);
  });

  it.each([
    ['unknown resource kind', publicationPath, (manifest) => { seriesEntry(manifest).resource_kinds.push('official'); }],
    ['duplicate resource kind', publicationPath, (manifest) => { seriesEntry(manifest).resource_kinds.push('archive'); }],
    ['missing selection', publicationPath, (manifest) => { delete seriesEntry(manifest).resource_kinds; }],
    ['malformed selection', publicationPath, (manifest) => { seriesEntry(manifest).resource_kinds = 'archive'; }],
    ['missing selected resource', seriesPath, (catalog) => { delete seriesRecord(catalog).resources.archive; }],
    ['invalid selected resource URL', seriesPath, (catalog) => { seriesRecord(catalog).resources.archive = 'ftp://example.org/archive'; }],
    ['empty selected resource URL', seriesPath, (catalog) => { seriesRecord(catalog).resources.archive = ''; }],
    ['private file URL', seriesPath, (catalog) => { seriesRecord(catalog).resources.archive = 'file:///private/research'; }],
  ])('rejects %s', (_name, relative, mutate) => {
    const input = fixture();
    input.mutate(relative, mutate);
    expect(() => input.plan()).toThrow();
  });

  it.each(['url', 'source_url', 'resources', 'label', 'official'])('rejects series publication override/presentation field %s', (field) => {
    const input = fixture();
    input.mutate(publicationPath, (manifest) => {
      seriesEntry(manifest)[field] = field === 'resources'
        ? { archive: 'https://example.org/publication-override/' }
        : 'https://example.org/publication-override/';
    });
    expect(() => input.plan()).toThrow();
  });
});

describe('Readings private editorial publication', () => {
  it('publishes only the explicitly selected introduction without its source locator', () => {
    const input = fixture();
    const series = input.plan().readingsSeries[0];
    expect(series.editorial).toEqual(input.read(editorialPath));
    expect(Object.keys(series.editorial)).toEqual(['introduction']);
    expect(JSON.stringify(series)).not.toContain('editorial_path');
    expect(JSON.stringify(series)).not.toContain(editorialPath);
    expect(ReadingsSeriesSchema.safeParse(series).success).toBe(true);
  });

  it.each(['research/readings/series.json'])(
    'rejects an invalid selected editorial path %j', (selectedPath) => {
      const input = fixture();
      input.mutate(publicationPath, (manifest) => { seriesEntry(manifest).editorial_path = selectedPath; });
      expect(() => input.plan()).toThrow(/editorial_path/i);
    },
  );

  it('fails when the selected editorial file is missing', () => {
    const input = fixture();
    input.remove(editorialPath);
    expect(() => input.plan()).toThrow(/missing.*web\/editorial\/readings\.json/);
  });

  it.each([
    ['structured references', (editorial) => { editorial.references = [earliestDirectory]; }],
    ['IFI-specific lead', (editorial) => { editorial.symposiumsLead = 'Other content'; }],
  ])('rejects editorial content with %s', (_name, mutate) => {
    const input = fixture();
    input.mutate(editorialPath, mutate);
    expect(() => input.plan()).toThrow(/editorial|introduction/i);
  });

  it('does not turn prose mentions into additional conference selections or private facts', () => {
    const input = fixture();
    const before = input.plan();
    const paragraphs = [`{{conference:${unnumbered1997Directory}}}`, '{{series:organizers}}'];
    input.mutate(editorialPath, (editorial) => { editorial.introduction = paragraphs; });
    input.mutate(seriesPath, (catalog) => { seriesRecord(catalog).organizers = ['PRIVATE_ORGANIZER_SENTINEL']; });
    before.readingsSeries[0].editorial.introduction = paragraphs;
    const after = input.plan();
    expect(after).toEqual(before);
    expect(after.readings).toEqual(before.readings);
    expect(JSON.stringify(after)).not.toContain('PRIVATE_ORGANIZER_SENTINEL');
  });

  it('omits unselected editorial even when the former file is invalid', () => {
    const input = fixture();
    const before = input.plan();
    input.mutate(publicationPath, (manifest) => { delete seriesEntry(manifest).editorial_path; });
    input.write(editorialPath, { unsupported: 'UNSELECTED_EDITORIAL_SENTINEL' });
    delete before.readingsSeries[0].editorial;
    expect(input.plan()).toEqual(before);
  });
});

describe('strict public Readings series schemas', () => {
  it('accepts the minimal public series schema and all allowed resource kinds', () => {
    const series = fixture().plan().readingsSeries[0];
    expect(ReadingsSeriesSchema.safeParse(series).success).toBe(true);
    expect(series.resources.map((resource) => resource.kind)).toEqual(resourceKinds);
  });

  it.each([
    ['private editorial locator', (record) => { record.editorial.editorial_path = editorialPath; }],
    ['empty editorial introduction', (record) => { record.editorial.introduction = []; }],
    ['structured editorial references', (record) => { record.editorial.references = [earliestDirectory]; }],
    ['IFI-specific editorial lead', (record) => { record.editorial.symposiumsLead = 'Other content'; }],
    ['private locator', (record) => { record.local_directory = earliestDirectory; }],
    ['private earliest relation', (record) => { record.history.earliest_archived_event_directory = earliestDirectory; }],
    ['private first international relation', (record) => { record.history.first_international_event_directory = firstInternationalDirectory; }],
    ['private positioning', (record) => { record.positioning_ru = 'private'; }],
    ['private memorial facts', (record) => { record.memorial_background_ru = 'private'; }],
    ['private continuity facts', (record) => { record.continuity_summary_ru = 'private'; }],
    ['all event IDs', (record) => { record.event_ids = ['private']; }],
    ['organizers', (record) => { record.organizers = ['private']; }],
    ['wrong type', (record) => { record.type = 'research_network'; }],
    ['empty Russian name', (record) => { record.name = ' '; }],
    ['invalid relation ID', (record) => { record.history.firstInternationalEventId = '../private'; }],
    ['unknown resource kind', (record) => { record.resources[0].kind = 'official'; }],
    ['duplicate resource kind', (record) => { record.resources.push(structuredClone(record.resources[0])); }],
    ['invalid public URL', (record) => { record.resources[0].url = 'file:///private/archive'; }],
    ['resource label', (record) => { record.resources[0].label = 'Archive'; }],
    ['resource official flag', (record) => { record.resources[0].official = true; }],
  ])('rejects %s from generated public series data', (_name, mutate) => {
    const series = fixture().plan().readingsSeries[0];
    mutate(series);
    expect(ReadingsSeriesSchema.safeParse(series).success).toBe(false);
  });

  it.each(['earliestArchivedEventId', 'firstInternationalEventId'])('requires %s to resolve to exactly one public Readings event', (relation) => {
    const records = fixture().plan();
    const id = records.readingsSeries[0].history[relation];
    const missing = structuredClone(records);
    missing.readings = missing.readings.filter((record) => record.id !== id);
    expect(ResearchRecordsSchema.safeParse(missing).success).toBe(false);
    const duplicate = structuredClone(records);
    duplicate.readings.push(structuredClone(duplicate.readings.find((record) => record.id === id)));
    expect(ResearchRecordsSchema.safeParse(duplicate).success).toBe(false);
    const anotherKind = structuredClone(records);
    anotherKind.readingsSeries[0].history[relation] = anotherKind.ifiSymposiums[0].id;
    expect(ResearchRecordsSchema.safeParse(anotherKind).success).toBe(false);
  });
});

describe('Readings publication regression', () => {
  it('matches the enabled series and current public events in the real generated baseline', () => {
    const records = plannedResearchRecords({
      projectRoot,
      researchRoot,
      outputRoot: path.join(projectRoot, '.website-input'),
    });
    const generated = readJson(projectRoot, '.website-input/research-records.json');
    expect(records).toEqual(generated);
    expect(records.readings.map((record) => record.id)).toEqual([
      earliestPublicId,
      firstInternationalPublicId,
      'readings-2002-iv-social-ideal',
      'readings-2004-vi-place-in-philosophy',
      'readings-2014-xvi-dialectics-culture',
      'readings-2016-xviii-philosophy-modernity',
      'readings-2018-xx-ilyenkov-marx',
      'readings-2019-xxi-unity-wholeness',
      'readings-2021-xxii-ilyenkov-hegel',
      'readings-2022-xxiii-human-sensibility',
    ]);
    expect(records.readings.find((record) => record.id === earliestPublicId).edition).toBe('早期会议（未编号）');
    const selectedSeries = seriesEntry(publication);
    expect(records.readingsSeries).toEqual([{
      id: 'ilyenkov-readings-series',
      title: '伊里因科夫学术报告会',
      name: 'Ильенковские чтения',
      summary: selectedSeries.summary_zh,
      editorial: readJson(researchRoot, selectedSeries.editorial_path),
      type: 'academic_conference_series',
      history: {
        earliestArchivedEventId: earliestPublicId,
        firstInternationalEventId: firstInternationalPublicId,
      },
      resources: resourceKinds.map((kind) => ({ kind, url: privateSeries.resources[kind] })),
    }]);
    for (const entry of selectedReadings) {
      expect(entry.record_directory).toBeTruthy();
      expect(entry).not.toHaveProperty('record_id');
    }
    const serialized = JSON.stringify(records);
    for (const field of ['record_directory', 'local_directory', 'positioning_ru', 'memorial_background_ru', 'continuity_summary_ru']) {
      expect(serialized).not.toContain(field);
    }
    for (const entry of selectedReadings) expect(serialized).not.toContain(entry.record_directory);
    expect(ResearchRecordsSchema.parse(records)).toEqual(records);
    expect(getPublicReadingsSeries()).toEqual(records.readingsSeries);
  });

  it('supports explicitly unselected series without changing the public event collection', () => {
    const input = fixture();
    const before = input.plan();
    input.mutate(publicationPath, (manifest) => {
      manifest.records = manifest.records.filter((entry) => entry.kind !== 'ilyenkov_readings_series');
    });
    const after = input.plan();
    expect(after).not.toHaveProperty('readingsSeries');
    for (const key of Object.keys(before).filter((key) => key !== 'readingsSeries')) {
      expect(after[key], key).toEqual(before[key]);
    }
    expect(ResearchRecordsSchema.safeParse(after).success).toBe(true);
  });

  it('renders the selected events in the Readings detail and keeps a concise research entry', () => {
    const records = readJson(projectRoot, '.website-input/research-records.json');
    const html = readFileSync(builtRoutePath('/research/'), 'utf8');
    const detail = readFileSync(builtRoutePath('/research/readings/'), 'utf8');
    for (const reading of records.readings) expect(detail).toContain(reading.title);
    expect(html).toContain('researcher-andrey-maidansky-heading');
    expect(html).not.toContain('research-sites-heading');
    expect(html).toContain('readings-heading');
    expect(html).toContain('href="/research/readings/"');
    const entry = html.match(/<section\b[^>]*aria-labelledby="readings-heading"[^>]*>([\s\S]*?)<\/section>/)[1];
    expect(entry).not.toMatch(/<ol\b|<article\b|<h3\b/);
    expect(entry).toContain(records.readingsSeries[0].summary);
    expect(routeExists('/research/')).toBe(true);
    expect(routeExists('/research/ifi/')).toBe(true);
    expect(routeExists('/research/readings/')).toBe(true);
  });
});
