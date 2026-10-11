import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GeneratedGlossaryRecordSchema,
  GeneratedGlossarySchema,
  GLOSSARY_NAME_TYPES,
} from '../src/lib/glossary-record.mjs';
import { getGlossary } from '../src/lib/glossary';

const injected = vi.hoisted(() => ({
  text: '[]',
  missing: false,
  reads: [] as string[],
  file: `${process.cwd()}/.website-input/glossary.json`,
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    readFileSync(file: unknown, ...options: unknown[]) {
      injected.reads.push(String(file));
      if (String(file) === injected.file) {
        if (injected.missing) throw new Error('missing generated glossary input');
        return injected.text;
      }
      return Reflect.apply(actual.readFileSync, actual, [file, ...options]);
    },
  };
});

function record(collection = 'terms', id = 'sample-term') {
  return {
    collection,
    id,
    canonical: 'sample term',
    forms: ['sample terms'],
    zh_preferred: '示例术语',
    zh_alternatives: ['示例译名'],
    notes: '用于说明译名。',
  };
}

function setRecords(records: unknown): void {
  injected.text = JSON.stringify(records);
}

beforeEach(() => {
  injected.text = '[]';
  injected.missing = false;
  injected.reads = [];
  vi.stubEnv('PROD', false);
});

afterEach(() => {
  expect(injected.reads.every((file) => file === injected.file))
    .toBe(true);
  vi.unstubAllEnvs();
});

describe('generated glossary field contract', () => {
  it('accepts an empty public collection and empty optional-content arrays', () => {
    expect(GeneratedGlossarySchema.parse([])).toEqual([]);
    const emptyContent = { ...record(), forms: [], zh_alternatives: [], notes: '' };
    expect(GeneratedGlossaryRecordSchema.parse(emptyContent)).toEqual(emptyContent);
  });

  it('retains source spelling, whitespace and plain-text notes', () => {
    const source = {
      ...record('ilyenkov', 'ideal'),
      canonical: '  идеальное  ',
      forms: ['  идеального  ', 'Идеальное'],
      zh_preferred: '  观念的东西  ',
      zh_alternatives: ['  理想的  '],
      notes: '\n参见 glossary/other.json；**用法** <tag>。\n',
    };
    expect(GeneratedGlossaryRecordSchema.parse(source)).toEqual(source);
  });

  it.each([
    'collection', 'id', 'canonical', 'forms', 'zh_preferred', 'zh_alternatives', 'notes',
  ])('requires the public %s field', (field) => {
    const source: Record<string, unknown> = record();
    delete source[field];
    expect(GeneratedGlossaryRecordSchema.safeParse(source).success).toBe(false);
  });

  it.each(['canonical', 'zh_preferred'])('rejects blank or non-string %s values', (field) => {
    for (const value of ['', ' \t\n ', null, 123, ['text']]) {
      expect(GeneratedGlossaryRecordSchema.safeParse({ ...record(), [field]: value }).success)
        .toBe(false);
    }
  });

  it.each(['forms', 'zh_alternatives'])('requires %s to contain nonblank strings', (field) => {
    for (const value of [null, 'text', {}, [''], [' \t\n '], [123], [null], ['valid', '']]) {
      expect(GeneratedGlossaryRecordSchema.safeParse({ ...record(), [field]: value }).success)
        .toBe(false);
    }
  });

  it('requires notes to be a string even when there is no explanation', () => {
    for (const notes of [null, 123, [], {}]) {
      expect(GeneratedGlossaryRecordSchema.safeParse({ ...record(), notes }).success)
        .toBe(false);
    }
  });

  it.each(['collection', 'id'])('accepts complete lowercase slugs and rejects unsafe %s values', (field) => {
    for (const value of ['author-2', 'a', '2026']) {
      expect(GeneratedGlossaryRecordSchema.safeParse({ ...record(), [field]: value }).success)
        .toBe(true);
    }
    for (const value of [
      '', 'Uppercase', '../terms', 'one/two', 'one\\two', 'one--two', '-one',
      'one-', 'one_two', 'one ', 'one\n', 'one\r\n', '术语', null, 123,
    ]) {
      expect(GeneratedGlossaryRecordSchema.safeParse({ ...record(), [field]: value }).success, String(value))
        .toBe(false);
    }
  });

  it('permits only the defined name types, and only for the names collection', () => {
    expect([...GLOSSARY_NAME_TYPES]).toEqual([
      'person', 'organization', 'institution', 'work', 'journal',
    ]);
    for (const type of GLOSSARY_NAME_TYPES) {
      const source = { ...record('glossary'), type };
      expect(GeneratedGlossaryRecordSchema.parse(source)).toEqual(source);
    }
    expect(GeneratedGlossaryRecordSchema.safeParse(record('glossary')).success)
      .toBe(false);
    for (const type of ['concept', '', null, 123]) {
      expect(GeneratedGlossaryRecordSchema.safeParse({ ...record('glossary'), type }).success)
        .toBe(false);
    }
    for (const collection of ['terms', 'ilyenkov', 'other-author']) {
      expect(GeneratedGlossaryRecordSchema.safeParse({ ...record(collection), type: 'person' }).success)
        .toBe(false);
    }
  });

  it.each([
    'status', 'category', 'author', 'path', 'route', 'publication_scope', 'source_path', 'private_id', 'unknown',
  ])('rejects the undeclared %s field rather than carrying it into the public data', (field) => {
    for (const source of [record(), { ...record('glossary'), type: 'person' }]) {
      expect(GeneratedGlossaryRecordSchema.safeParse({ ...source, [field]: 'hidden value' }).success)
        .toBe(false);
    }
  });

  it('requires an array of valid records and unique collection/id identities', () => {
    const term = record('terms', 'same-id');
    const concept = record('ilyenkov', 'same-id');
    expect(GeneratedGlossarySchema.parse([term, concept])).toEqual([term, concept]);
    expect(GeneratedGlossarySchema.safeParse([term, { ...term, zh_preferred: '另一译名' }]).success)
      .toBe(false);
    for (const value of [null, {}, { records: [term] }, [term, { ...concept, status: 'approved' }]]) {
      expect(GeneratedGlossarySchema.safeParse(value).success).toBe(false);
    }
  });
});

describe('public glossary data reader', () => {
  it('reads only the generated input and accepts an empty public glossary', () => {
    expect(getGlossary()).toEqual([]);
    expect(injected.reads).toEqual([injected.file]);
  });

  it('preserves public source text while deriving categories and safe independent routes', () => {
    const term = { ...record('terms', 'same-id'), notes: '\n参见内部文件名；原样说明。\n' };
    const concept = { ...record('ilyenkov', 'same-id'), canonical: '  идеальное  ' };
    const name = { ...record('glossary', 'same-id'), type: 'person' };
    setRecords([term, concept, name]);
    const entries = getGlossary();

    expect(entries).toHaveLength(3);
    for (const source of [term, concept, name]) {
      const entry = entries.find((candidate) => candidate.collection === source.collection);
      expect(entry).toMatchObject(source);
      expect(entry?.route).toBe(`/glossary/${source.collection}/${source.id}/`);
      expect(entry?.collectionLabel.trim().length).toBeGreaterThan(0);
    }
    expect(entries.find((entry) => entry.collection === 'terms')).toMatchObject({
      category: 'terms', categoryLabel: '通用学科术语',
    });
    expect(entries.find((entry) => entry.collection === 'glossary')).toMatchObject({
      category: 'names', categoryLabel: '专名与体制词',
    });
    expect(entries.find((entry) => entry.collection === 'ilyenkov')).toMatchObject({
      category: 'concepts', categoryLabel: '作者理论概念',
    });
    expect(new Set(entries.map((entry) => entry.route)).size).toBe(3);
    expect(injected.reads).toEqual([injected.file]);
  });

  it('returns a deterministic identity order independent of generated input order', () => {
    const source = [record('terms', 'z'), record('ilyenkov', 'a'), record('terms', 'a')];
    setRecords(source);
    const first = getGlossary().map((entry) => entry.route);
    setRecords([...source].reverse());
    expect(getGlossary().map((entry) => entry.route)).toEqual(first);
    expect(new Set(first).size).toBe(source.length);
    expect(injected.reads).toEqual([injected.file, injected.file]);
  });

  it('rereads development data so amendments and withdrawals replace earlier records', () => {
    setRecords([record('terms', 'kept'), record('ilyenkov', 'withdrawn')]);
    expect(getGlossary().map((entry) => entry.id).sort()).toEqual(['kept', 'withdrawn']);

    setRecords([{ ...record('terms', 'kept'), zh_preferred: '修订译名' }]);
    expect(getGlossary()).toEqual([expect.objectContaining({
      collection: 'terms', id: 'kept', zh_preferred: '修订译名',
    })]);

    setRecords([]);
    expect(getGlossary()).toEqual([]);
    expect(injected.reads).toEqual([injected.file, injected.file, injected.file]);
  });

  it('fails on missing generated data even after an earlier successful read', () => {
    setRecords([record()]);
    expect(getGlossary()).toHaveLength(1);
    injected.missing = true;
    expect(() => getGlossary()).toThrow('missing generated glossary input');
    expect(injected.reads).toEqual([injected.file, injected.file]);
  });

  it('fails on malformed generated JSON rather than retaining earlier records', () => {
    setRecords([record()]);
    expect(getGlossary()).toHaveLength(1);
    injected.text = '{';
    expect(() => getGlossary()).toThrow();
    expect(injected.reads).toEqual([injected.file, injected.file]);
  });

  it.each([
    { label: 'unknown field', value: [{ ...record(), status: 'approved' }] },
    { label: 'missing field', value: [{ collection: 'terms', id: 'sample-term' }] },
    { label: 'duplicate identity', value: [record(), record()] },
    { label: 'unsafe identity', value: [{ ...record(), id: '../private' }] },
  ])('fails on schema-invalid input ($label) without falling back', ({ value }) => {
    setRecords([record()]);
    expect(getGlossary()).toHaveLength(1);
    setRecords(value);
    expect(() => getGlossary()).toThrow();
    expect(injected.reads).toEqual([injected.file, injected.file]);
  });
});
