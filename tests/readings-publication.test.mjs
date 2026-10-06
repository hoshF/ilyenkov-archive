import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { plannedResearchRecords } from '../scripts/lib/research-sync/planner.mjs';
import { getPublicReadingsSeries, ReadingsSeriesSchema, ResearchRecordsSchema } from '../src/lib/research-records';
import { builtRoutePath, routeExists } from './helpers/pages';
import { researchRoot } from './helpers/publication';

const projectRoot = process.cwd();
const publicationPath = 'research/publication.json';
const eventsPath = 'research/readings/events.json';
const seriesPath = 'research/readings/series.json';
const earliestDirectory = 'events/1991-unnumbered-first-readings';
const firstInternationalDirectory = 'events/1999-I-first-international';
const unnumbered1997Directory = 'events/1997-unnumbered-mgap';
const edition2011Directory = 'events/2011-XIII-philosophy-and-culture';
const memorial2011Directory = 'events/2011-03-memorial-conference-thinking-and-activity';
const resourceKinds = ['archive', 'society', 'historical_archive'];
const readJson = (root, relative) => JSON.parse(readFileSync(path.join(root, relative), 'utf8'));
const publication = readJson(researchRoot, publicationPath);
const selectedEntries = publication.records.filter((entry) => entry.publication_scope === 'website_public');
const legacyReadings = selectedEntries.filter((entry) => entry.kind === 'ilyenkov_readings');
const privateSeries = readJson(researchRoot, seriesPath).records.find((record) => (
  record.series_id === 'ilyenkov-readings-series'
));
const roots = [];

afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

/** Fixtures contain selected JSON facts and temporary title headers, never research bodies. */
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
    for (const field of ['record_path', 'source_path']) {
      if (entry[field]) relativePaths.add(entry[field]);
    }
  });
  for (const relative of relativePaths) {
    const target = path.join(sourceRoot, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(path.join(researchRoot, relative), 'utf8'));
  }
  for (const entry of selectedEntries.filter((record) => record.kind === 'researcher_profile')) {
    for (const work of entry.works) {
      const target = path.join(outputRoot, 'articles', `${work.archive_id}.md`);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, `---\ntitle_zh: ${JSON.stringify(work.title_zh)}\n---\n`);
    }
  }
  return {
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

const readingEntry = (manifest, publicId = legacyReadings[0].public_id) => manifest.records.find((entry) => (
  entry.kind === 'ilyenkov_readings' && entry.public_id === publicId
));
const seriesEntry = (manifest) => manifest.records.find((entry) => entry.kind === 'ilyenkov_readings_series');
const seriesRecord = (catalog) => catalog.records.find((record) => record.series_id === privateSeries.series_id);
const conference = (catalog, directory) => catalog.conferences.find((record) => record.local_directory === directory);

function addReading(input, directory, publicId = 'fixture-reading') {
  const event = conference(input.read(eventsPath), directory);
  const sourceIds = directory === firstInternationalDirectory
    ? ['src-1999-002', 'src-1999-005']
    : directory === unnumbered1997Directory ? ['src-1997-006']
      : directory === edition2011Directory ? ['src-2011-001'] : ['src-2011-03-001'];
  const entry = {
    public_id: publicId,
    publication_scope: 'website_public',
    kind: 'ilyenkov_readings',
    record_path: eventsPath,
    record_directory: directory,
    source_path: `research/readings/${directory}/sources.json`,
    edition_zh: directory === firstInternationalDirectory ? '第一届'
      : directory === unnumbered1997Directory ? '未编号' : '第十三届',
    title_zh: event.title_zh,
    location_zh: directory === firstInternationalDirectory ? '泽列诺格勒'
      : directory === unnumbered1997Directory ? '莫斯科' : '阿斯塔纳',
    source_ids: sourceIds,
  };
  input.mutate(publicationPath, (manifest) => { manifest.records.push(entry); });
  return entry;
}

function enableSeries(input, { publishFirst = true } = {}) {
  if (publishFirst) addReading(input, firstInternationalDirectory, 'fixture-first-international');
  input.mutate(publicationPath, (manifest) => {
    // Relations resolve across the full manifest, independently of publication order.
    manifest.records.unshift({
      public_id: 'fixture-readings-series',
      publication_scope: 'website_public',
      kind: 'ilyenkov_readings_series',
      record_path: seriesPath,
      record_id: privateSeries.series_id,
      title_zh: '伊里因科夫学术报告会',
      summary_zh: '围绕伊里因科夫及相关哲学问题持续开展的学术会议系列。',
      resource_kinds: [...resourceKinds],
    });
  });
  return input;
}

describe('Readings directory publication locator', () => {
  it('uses a unique directory and public identity without requiring a year record_id', () => {
    const input = fixture();
    const entry = addReading(input, firstInternationalDirectory, 'fixture-first-international');
    const reading = input.plan().readings.find((record) => record.id === entry.public_id);
    const event = conference(input.read(eventsPath), firstInternationalDirectory);
    expect(reading.title).toBe(entry.title_zh);
    expect(reading.period).toEqual({ start: event.start_date, end: event.end_date });
    expect(reading.edition).toBe('第一届');
    expect(reading).not.toHaveProperty('local_directory');
    expect(reading).not.toHaveProperty('record_directory');
    expect(ResearchRecordsSchema.safeParse(input.plan()).success).toBe(true);
  });

  it('fully prefers the explicit directory over an obsolete year locator', () => {
    const input = fixture();
    const before = input.plan();
    input.mutate(publicationPath, (manifest) => {
      const entry = readingEntry(manifest);
      entry.record_directory = earliestDirectory;
      entry.record_id = '2011';
    });
    expect(input.plan()).toEqual(before);
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
    expect(() => input.plan()).toThrow();
  });

  it.each(['', '   ', null, 1991, []])('does not fall back to the legacy year for an invalid explicit directory %j', (directory) => {
    const input = fixture();
    input.mutate(publicationPath, (manifest) => { readingEntry(manifest).record_directory = directory; });
    expect(() => input.plan()).toThrow();
  });

  it('does not fall back to a valid legacy year when the explicit directory is missing from the catalog', () => {
    const input = fixture();
    input.mutate(publicationPath, (manifest) => {
      readingEntry(manifest).record_directory = 'events/not-an-archived-reading';
    });
    expect(() => input.plan()).toThrow();
  });

  it('rejects an ambiguous directory instead of taking the first matching event', () => {
    const input = fixture();
    addReading(input, firstInternationalDirectory);
    input.mutate(eventsPath, (catalog) => {
      catalog.conferences.push(structuredClone(conference(catalog, firstInternationalDirectory)));
    });
    expect(() => input.plan()).toThrow();
  });

  it('requires the selected source path to belong to the located edition', () => {
    const input = fixture();
    addReading(input, firstInternationalDirectory);
    input.mutate(publicationPath, (manifest) => {
      readingEntry(manifest, 'fixture-reading').source_path = legacyReadings[0].source_path;
      readingEntry(manifest, 'fixture-reading').source_ids = [...legacyReadings[0].source_ids];
    });
    expect(() => input.plan()).toThrow();
  });

  it.each(['not_applicable', '', null, 'one'])('rejects a non-edition identity %j', (edition) => {
    const input = fixture();
    addReading(input, firstInternationalDirectory);
    input.mutate(eventsPath, (catalog) => {
      conference(catalog, firstInternationalDirectory).edition_roman = edition;
    });
    expect(() => input.plan()).toThrow();
  });

  it('accepts other archived unnumbered editions without treating them as the earliest series relation', () => {
    const input = fixture();
    addReading(input, unnumbered1997Directory, 'fixture-1997-unnumbered');
    const record = input.plan().readings.find((reading) => reading.id === 'fixture-1997-unnumbered');
    expect(record.title).toBe('1997 年伊里因科夫学术报告会');
    expect(record.period).toEqual({ start: '1997-02-18', end: '1997-02-19' });
    enableSeries(input);
    input.mutate(seriesPath, (catalog) => {
      seriesRecord(catalog).earliest_archived_event_directory = unnumbered1997Directory;
    });
    expect(() => input.plan()).toThrow();
  });

  it('allows all currently selected legacy entries to migrate without changing public output', () => {
    const input = fixture();
    const before = input.plan();
    input.mutate(publicationPath, (manifest) => {
      for (const entry of manifest.records.filter((record) => record.kind === 'ilyenkov_readings')) {
        entry.record_directory = entry.source_path.replace(/^research\/readings\//, '').replace(/\/sources\.json$/, '');
        delete entry.record_id;
      }
    });
    expect(input.plan()).toEqual(before);
  });

  it('does not offer year-only compatibility to newly selected publications', () => {
    const input = fixture();
    input.mutate(publicationPath, (manifest) => { readingEntry(manifest).public_id = 'new-year-only-reading'; });
    expect(() => input.plan()).toThrow();
  });

  it('does not allow an existing legacy public ID to change its approved year', () => {
    const input = fixture();
    input.mutate(publicationPath, (manifest) => { readingEntry(manifest).record_id = '1999'; });
    expect(() => input.plan()).toThrow();
  });

  it('requires legacy year selection to be unique rather than using the first match', () => {
    const input = fixture();
    input.mutate(eventsPath, (catalog) => {
      catalog.conferences.push({
        ...conference(catalog, earliestDirectory),
        local_directory: 'events/another-1991-record',
      });
    });
    expect(() => input.plan()).toThrow();
  });

  it('limits legacy compatibility to the canonical Readings catalog', () => {
    const input = fixture();
    const alternate = 'research/readings/other-events.json';
    input.write(alternate, input.read(eventsPath));
    input.mutate(publicationPath, (manifest) => { readingEntry(manifest).record_path = alternate; });
    expect(() => input.plan()).toThrow();
  });

  it('also requires a legacy event directory to remain unique even when its year is unique', () => {
    const input = fixture();
    input.mutate(eventsPath, (catalog) => {
      catalog.conferences.push({ ...conference(catalog, earliestDirectory), year: 1990 });
    });
    expect(() => input.plan()).toThrow();
  });
});

describe('Readings series publication adapter', () => {
  it('reads the selected series and maps both private directories to distinct public event IDs', () => {
    const input = enableSeries(fixture());
    const records = input.plan();
    const series = records.readingsSeries[0];
    const entry = seriesEntry(input.read(publicationPath));
    expect(series).toEqual({
      id: entry.public_id,
      title: entry.title_zh,
      name: privateSeries.name_ru,
      summary: entry.summary_zh,
      type: 'academic_conference_series',
      history: {
        earliestArchivedEventId: legacyReadings[0].public_id,
        firstInternationalEventId: 'fixture-first-international',
      },
      resources: resourceKinds.map((kind) => ({ kind, url: privateSeries.resources[kind] })),
    });
    expect(ResearchRecordsSchema.safeParse(records).success).toBe(true);
    expect(records.readings.some((record) => record.id === series.history.earliestArchivedEventId)).toBe(true);
    expect(records.readings.some((record) => record.id === series.history.firstInternationalEventId)).toBe(true);
  });

  it('uses the selected publication public ID rather than a directory or private series identity', () => {
    const input = enableSeries(fixture());
    const publicId = 'public-earliest-archived-reading';
    input.mutate(publicationPath, (manifest) => {
      const entry = readingEntry(manifest);
      entry.record_directory = earliestDirectory;
      entry.public_id = publicId;
      delete entry.record_id;
    });
    const series = input.plan().readingsSeries[0];
    expect(series.history.earliestArchivedEventId).toBe(publicId);
    expect(series.id).not.toBe(privateSeries.series_id);
    expect(JSON.stringify(series)).not.toContain('events/');
  });

  it('does not publish private series summaries, directories or newly added private fields', () => {
    const input = enableSeries(fixture());
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
    expect(Object.keys(series).sort()).toEqual(['history', 'id', 'name', 'resources', 'summary', 'title', 'type']);
    expect(Object.keys(series.history).sort()).toEqual(['earliestArchivedEventId', 'firstInternationalEventId']);
    expect(JSON.stringify(series)).not.toContain('PRIVATE_');
    expect(JSON.stringify(series)).not.toContain('events/');
    expect(JSON.stringify(series)).not.toContain(privateSeries.series_id);
  });

  it('fails if series publication is enabled before the first international event is public', () => {
    const input = enableSeries(fixture(), { publishFirst: false });
    expect(() => input.plan()).toThrow();
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
    const input = enableSeries(fixture());
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
    const input = enableSeries(fixture());
    input.mutate(eventsPath, mutate);
    expect(() => input.plan()).toThrow();
  });

  it.each([
    ['numbered event as earliest history', 'earliest_archived_event_directory', firstInternationalDirectory],
    ['unnumbered event as first international history', 'first_international_event_directory', earliestDirectory],
    ['memorial as first international history', 'first_international_event_directory', memorial2011Directory],
  ])('rejects %s', (_name, field, directory) => {
    const input = enableSeries(fixture());
    input.mutate(seriesPath, (catalog) => { seriesRecord(catalog)[field] = directory; });
    expect(() => input.plan()).toThrow();
  });

  it.each(['private_research', 'metadata_only', 'restricted_study'])('requires relation publications to be website_public, not %s', (scope) => {
    const input = enableSeries(fixture());
    input.mutate(publicationPath, (manifest) => {
      readingEntry(manifest, 'fixture-first-international').publication_scope = scope;
    });
    expect(() => input.plan()).toThrow();
  });

  it('rejects multiple public publications of the same relation event even when public IDs differ', () => {
    const input = enableSeries(fixture());
    input.mutate(publicationPath, (manifest) => {
      manifest.records.push({ ...readingEntry(manifest, 'fixture-first-international'), public_id: 'second-public-first-event' });
    });
    expect(() => input.plan()).toThrow();
  });

  it('does not resolve a relation through a publication of another kind', () => {
    const input = enableSeries(fixture());
    input.mutate(publicationPath, (manifest) => {
      readingEntry(manifest, 'fixture-first-international').kind = 'biography_event';
    });
    expect(() => input.plan()).toThrow();
  });

  it('reads series facts only from the canonical series catalog', () => {
    const input = enableSeries(fixture());
    const alternate = 'research/readings/another-series.json';
    input.write(alternate, input.read(seriesPath));
    input.mutate(publicationPath, (manifest) => { seriesEntry(manifest).record_path = alternate; });
    expect(() => input.plan()).toThrow();
  });

  it('leaves every other collection unchanged when only private series presentation facts change', () => {
    const input = enableSeries(fixture());
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
    const input = enableSeries(fixture());
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
    const input = enableSeries(fixture());
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
    const input = enableSeries(fixture());
    input.mutate(relative, mutate);
    expect(() => input.plan()).toThrow();
  });

  it.each(['url', 'source_url', 'resources', 'label', 'official'])('rejects series publication override/presentation field %s', (field) => {
    const input = enableSeries(fixture());
    input.mutate(publicationPath, (manifest) => {
      seriesEntry(manifest)[field] = field === 'resources'
        ? { archive: 'https://example.org/publication-override/' }
        : 'https://example.org/publication-override/';
    });
    expect(() => input.plan()).toThrow();
  });
});

describe('strict public Readings series schemas', () => {
  it('accepts the minimal public series schema and all allowed resource kinds', () => {
    const series = enableSeries(fixture()).plan().readingsSeries[0];
    expect(ReadingsSeriesSchema.safeParse(series).success).toBe(true);
    expect(series.resources.map((resource) => resource.kind)).toEqual(resourceKinds);
  });

  it.each([
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
    const series = enableSeries(fixture()).plan().readingsSeries[0];
    mutate(series);
    expect(ReadingsSeriesSchema.safeParse(series).success).toBe(false);
  });

  it.each(['earliestArchivedEventId', 'firstInternationalEventId'])('requires %s to resolve to exactly one public Readings event', (relation) => {
    const records = enableSeries(fixture()).plan();
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
  it('keeps current selected event data and all other generated collections unchanged without enabled series', () => {
    const records = plannedResearchRecords({
      projectRoot,
      researchRoot,
      outputRoot: path.join(projectRoot, '.website-input'),
    });
    const generated = readJson(projectRoot, '.website-input/research-records.json');
    expect(records).toEqual(generated);
    expect(records.readings.map((record) => record.id)).toEqual(legacyReadings.map((entry) => entry.public_id));
    expect(records).not.toHaveProperty('readingsSeries');
    const parsed = ResearchRecordsSchema.parse(records);
    expect(parsed).toEqual(records);
    expect(parsed).not.toHaveProperty('readingsSeries');
    expect(getPublicReadingsSeries()).toEqual([]);
  });

  it('leaves the research page and IFI detail available without creating a Readings route', () => {
    const records = readJson(projectRoot, '.website-input/research-records.json');
    const html = readFileSync(builtRoutePath('/research/'), 'utf8');
    for (const reading of records.readings) expect(html).toContain(reading.title);
    expect(html).toContain('researchers-heading');
    expect(html).toContain('research-sites-heading');
    expect(html).toContain('readings-heading');
    expect(routeExists('/research/')).toBe(true);
    expect(routeExists('/research/ifi/')).toBe(true);
    expect(routeExists('/research/readings/')).toBe(false);
  });
});
