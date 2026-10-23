import { afterEach, describe, expect, it, vi } from 'vitest';
import * as researchRecords from '../src/lib/research-records';
import { getReadingsPageSeries } from '../src/lib/readings-page';

const target = researchRecords.getPublicReadingsSeries().find((series) => series.id === 'ilyenkov-readings-series')!;
const other = { ...target, id: 'another-readings-series', title: 'Another series' };

afterEach(() => vi.restoreAllMocks());

describe('Readings page identity selection', () => {
  it.each([
    ['target alone', [target]],
    ['target before another series', [target, other]],
    ['target after another series', [other, target]],
  ])('selects the current column by public identity: %s', (_label, series) => {
    vi.spyOn(researchRecords, 'getPublicReadingsSeries').mockReturnValue(series);
    expect(getReadingsPageSeries()).toBe(target);
  });

  it.each([
    ['no published series', []],
    ['only another series', [other]],
  ])('fails when the target is missing: %s', (_label, series) => {
    vi.spyOn(researchRecords, 'getPublicReadingsSeries').mockReturnValue(series);
    expect(() => getReadingsPageSeries()).toThrow('Public Readings series ilyenkov-readings-series is missing');
  });
});
