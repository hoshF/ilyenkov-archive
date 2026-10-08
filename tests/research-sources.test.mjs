import { describe, expect, it } from 'vitest';
import { biographySources, ifiSources, readingSources, sourceRecords, workSources } from '../scripts/lib/research-sync/sources.mjs';

const fixture = (urls) => ({
  records: [{
    source_id: 'selected-source',
    title: 'Selected research source',
    creator: 'Research archive',
    urls,
    supports: ['conference_title', 'conference_dates'],
  }],
});
const select = (data) => sourceRecords(data, ['selected-source'], 'Source fixture');

describe('research source public URLs', () => {
  it('retains the current URL and minimal output even when other URL forms and private metadata exist', () => {
    const data = fixture({
      current: 'https://example.org/current/',
      original: 'https://example.org/original/',
      archive: 'https://web.archive.org/web/20240101/https://example.org/original/',
      pdf: 'https://example.org/private-unselected.pdf',
      alternates: ['https://example.org/private-unselected/'],
    });
    Object.assign(data.records[0], {
      fetched_at: 'PRIVATE_FETCH_DATE',
      local_snapshot: 'PRIVATE_SNAPSHOT_PATH',
      internal_notes: 'PRIVATE_NOTE',
    });
    expect(select(data)).toEqual([{
      title: 'Selected research source',
      creator: 'Research archive',
      url: 'https://example.org/current/',
    }]);
  });

  it.each([undefined, null, '', '  '])('uses original when current is empty (%j)', (current) => {
    const data = fixture({
      current,
      original: 'http://example.org/original/',
      archive: 'https://web.archive.org/web/20240101/https://example.org/original/',
    });
    expect(select(data)[0].url).toBe('http://example.org/original/');
  });

  it.each([undefined, null, '', '  '])('uses archive when current and original are empty (%j)', (original) => {
    const archive = 'https://web.archive.org/web/20240101/https://example.org/original/';
    expect(select(fixture({ original, archive }))[0].url).toBe(archive);
  });

  it.each(['not-a-url', 'file:///private/research', 'ftp://example.org/source', 42, {}])(
    'rejects invalid nonempty current (%j) instead of silently selecting original or archive',
    (current) => {
      expect(() => select(fixture({
        current,
        original: 'https://example.org/original/',
        archive: 'https://web.archive.org/web/20240101/https://example.org/original/',
      }))).toThrow(/public http\(s\)|no public URL/);
    },
  );

  it('rejects invalid original rather than hiding it behind a valid archive URL', () => {
    expect(() => select(fixture({
      original: 'file:///private/source',
      archive: 'https://web.archive.org/web/20240101/https://example.org/original/',
    }))).toThrow(/public http\(s\)/);
  });

  it('rejects an invalid archive URL', () => {
    expect(() => select(fixture({ archive: 'file:///private/snapshot' }))).toThrow(/public http\(s\)/);
  });

  it('does not select PDFs, alternates or private archive metadata as a public source URL', () => {
    const data = fixture({
      pdf: 'https://example.org/source.pdf',
      alternates: ['https://example.org/alternate/'],
    });
    data.records[0].local_snapshot = 'private/archive.html';
    expect(() => select(data)).toThrow(/no public URL/);
  });

  it('keeps the existing array URL selection and flat URL compatibility', () => {
    expect(select(fixture(['https://example.org/first/', 'https://example.org/second/']))[0].url)
      .toBe('https://example.org/first/');
    const data = fixture(undefined);
    Object.assign(data.records[0], { url: 'https://example.org/flat/' });
    expect(select(data)[0].url).toBe('https://example.org/flat/');
    expect(() => select(fixture(['file:///private/first', 'https://example.org/second/'])))
      .toThrow(/public http\(s\)/);
  });

  it('supports Readings source fallback without weakening title and date evidence checks', () => {
    const data = fixture({ original: 'https://example.org/historical-program/' });
    expect(readingSources(data, ['selected-source'], 'Readings fixture'))
      .toEqual(select(data));
    data.records[0].supports = ['conference_title'];
    expect(() => readingSources(data, ['selected-source'], 'Readings fixture'))
      .toThrow(/conference dates/);
  });
});


describe('selected source identities resolve uniquely', () => {
  const source = {
    source_id: 'synthetic-source', title: 'Synthetic source', creator: null,
    url: 'https://example.org/source',
    supports: ['conference_title', 'conference_dates', 'biographical_fact', 'historical_date',
      'activity_title', 'activity_dates', 'activity_location'],
  };
  const adapters = [
    ['activity', sourceRecords], ['Readings', readingSources],
    ['IFI', ifiSources], ['biography', biographySources],
  ];
  it.each(adapters.flatMap(([name, adapt]) => [[name, 0, adapt], [name, 2, adapt]]))(
    'rejects %s source identity with %i matches', (_name, count, adapt) => {
      const data = { records: Array.from({ length: count }, () => structuredClone(source)) };
      expect(() => adapt(data, [source.source_id], 'Synthetic source selection')).toThrow(
        new RegExp(`source_id synthetic-source: expected exactly one match, found ${count}`),
      );
    },
  );
  it.each(adapters)('allows unselected duplicate identities in %s sources', (_name, adapt) => {
    const unselected = { ...source, source_id: 'synthetic-unselected' };
    const data = { records: [source, unselected, structuredClone(unselected)] };
    expect(adapt(data, [source.source_id], 'Synthetic source selection'))
      .toEqual(sourceRecords({ records: [source] }, [source.source_id], 'Synthetic source selection'));
  });
  it('allows the same URL on distinct sources selected by source_id', () => {
    const other = { ...source, source_id: 'synthetic-other' };
    expect(sourceRecords({ records: [source, other] }, [source.source_id, other.source_id], 'Synthetic sources')).toHaveLength(2);
  });

  const workSource = { title: 'Synthetic work source', url: 'https://example.org/work', kind: 'text', work_id: 'synthetic-work' };
  it.each([0, 2])('rejects a selected work-source URL with %i matches', (count) => {
    const data = { sources: Array.from({ length: count }, () => structuredClone(workSource)) };
    expect(() => workSources(data, [workSource.url], workSource.work_id, 'Synthetic work sources')).toThrow(
      new RegExp(`expected exactly one match, found ${count}`),
    );
  });
  it('allows unselected duplicate URLs without requiring database-wide URL uniqueness', () => {
    const unselected = { ...workSource, url: 'https://example.org/unselected' };
    const data = { sources: [workSource, unselected, structuredClone(unselected)] };
    expect(workSources(data, [workSource.url], workSource.work_id, 'Synthetic work sources'))
      .toEqual(workSources({ sources: [workSource] }, [workSource.url], workSource.work_id, 'Synthetic work sources'));
  });
});
