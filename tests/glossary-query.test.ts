import { describe, expect, it } from 'vitest';
import {
  compareGlossaryEntries,
  getGlossaryFacets,
  searchGlossary,
  toGlossaryEntry,
  type GeneratedGlossaryEntry,
  type GlossaryEntry,
} from '../src/lib/glossary-query';

function record(overrides: Partial<GeneratedGlossaryEntry> = {}): GeneratedGlossaryEntry {
  return {
    collection: 'ilyenkov',
    id: 'ideal',
    canonical: 'идеальное',
    forms: [],
    zh_preferred: '观念的东西',
    zh_alternatives: [],
    notes: '',
    ...overrides,
  };
}

const entry = (overrides: Partial<GeneratedGlossaryEntry> = {}): GlossaryEntry => (
  toGlossaryEntry(record(overrides))
);
const identities = (entries: readonly GlossaryEntry[]): string[] => (
  entries.map(({ collection, id }) => `${collection}/${id}`)
);

describe('public glossary presentation', () => {
  it.each([
    ['ilyenkov', 'concepts', '作者理论概念', '伊里因科夫'],
    ['hegel', 'concepts', '作者理论概念', '黑格尔'],
    ['kedrov', 'concepts', '作者理论概念', '凯德洛夫'],
    ['maidansky', 'concepts', '作者理论概念', '迈丹斯基'],
    ['mikhailov', 'concepts', '作者理论概念', '米哈伊洛夫'],
    ['spinoza', 'concepts', '作者理论概念', '斯宾诺莎'],
    ['vygotsky', 'concepts', '作者理论概念', '维果茨基'],
    ['terms', 'terms', '通用学科术语', '通用学科术语'],
    ['glossary', 'names', '专名与体制词', '专名与体制词'],
  ])('derives %s labels and routes from its public collection', (collection, category, categoryLabel, collectionLabel) => {
    const source = record({ collection, ...(collection === 'glossary' ? { type: 'person' as const } : {}) });
    expect(toGlossaryEntry(source)).toEqual({
      ...source,
      category,
      categoryLabel,
      collectionLabel,
      route: `/glossary/${collection}/ideal/`,
    });
  });

  it.each(['other-author', 'constructor', 'toString'])('uses the public identity for an unknown author %s', (collection) => {
    expect(toGlossaryEntry(record({ collection })).collectionLabel).toBe(collection);
  });

  it('keeps same-ID concepts from different authors as independent entries and routes', () => {
    const concepts = [entry({ collection: 'hegel' }), entry({ collection: 'spinoza' })];
    expect(searchGlossary(concepts, { query: 'идеальное' })).toHaveLength(2);
    expect(new Set(concepts.map(({ route }) => route)).size).toBe(2);
    expect(concepts.map(({ route }) => route)).toEqual([
      '/glossary/hegel/ideal/', '/glossary/spinoza/ideal/',
    ]);
  });
});

describe('public glossary search', () => {
  const concepts = [
    entry({
      id: 'ideal',
      forms: ['идеального', 'идеальным'],
      zh_alternatives: ['理想的东西'],
    }),
    entry({
      id: 'thinking-thing',
      canonical: 'Res  Cogitans',
      zh_preferred: '思维实体',
      forms: ['res cogitantes'],
      zh_alternatives: ['思维之物'],
    }),
    entry({ id: 'form', canonical: 'form', zh_preferred: '形式' }),
    entry({ id: 'accent', canonical: 'café', zh_preferred: '咖啡' }),
  ];

  it.each([
    ['观念的东西', 'ideal'],
    ['观念', 'ideal'],
    ['念的', 'ideal'],
    ['ИДЕАЛЬНОЕ', 'ideal'],
    ['идеальным', 'ideal'],
    ['理想的东西', 'ideal'],
    ['RES COGITANS', 'thinking-thing'],
    ['res cogitantes', 'thinking-thing'],
    ['思维之物', 'thinking-thing'],
    ['  RES\t COGITANS\n', 'thinking-thing'],
    ['ＦＯＲＭ', 'form'],
    ['café', 'accent'],
  ])('matches normalized Chinese, foreign terms and other forms: %s', (query, id) => {
    expect(searchGlossary(concepts, { query }).map((result) => result.id)).toEqual([id]);
  });

  it('prioritizes all primary-field matches over other forms, then exact, prefix and substring matches', () => {
    const ranked = [
      entry({ id: 'other-contains', zh_preferred: '阿', canonical: 'else-f', forms: ['embodied mind'] }),
      entry({ id: 'other-prefix', zh_preferred: '波', canonical: 'else-e', zh_alternatives: ['mindset'] }),
      entry({ id: 'other-exact', zh_preferred: '次', canonical: 'else-d', forms: ['mind'] }),
      entry({ id: 'primary-contains', zh_preferred: '丁', canonical: 'embodied mind', forms: ['mind'] }),
      entry({ id: 'primary-prefix', zh_preferred: '恶', canonical: 'mindset', zh_alternatives: ['mind'] }),
      entry({ id: 'primary-exact', zh_preferred: '弗', canonical: 'mind' }),
    ];
    expect(searchGlossary(ranked, { query: 'mind' }).map(({ id }) => id)).toEqual([
      'primary-exact', 'primary-prefix', 'primary-contains',
      'other-exact', 'other-prefix', 'other-contains',
    ]);
  });

  it('applies the same priority to the Chinese preferred translation and other Chinese forms', () => {
    const ranked = [
      entry({ id: 'other-exact', zh_preferred: '其他译法', canonical: 'other', zh_alternatives: ['观念'] }),
      entry({ id: 'primary-contains', zh_preferred: '主观念', canonical: 'contains' }),
      entry({ id: 'primary-prefix', zh_preferred: '观念的东西', canonical: 'prefix' }),
      entry({ id: 'primary-exact', zh_preferred: '观念', canonical: 'exact' }),
    ];
    expect(searchGlossary(ranked, { query: '观念' }).map(({ id }) => id)).toEqual([
      'primary-exact', 'primary-prefix', 'primary-contains', 'other-exact',
    ]);
  });

  it('uses preferred Chinese text, original term, collection and ID to break ties consistently', () => {
    const input = [
      entry({ id: 'b', collection: 'spinoza', zh_preferred: '波', canonical: 'same' }),
      entry({ id: 'b', collection: 'hegel', zh_preferred: '波', canonical: 'same' }),
      entry({ id: 'a', collection: 'hegel', zh_preferred: '波', canonical: 'same' }),
      entry({ id: 'c', zh_preferred: '波', canonical: 'earlier', forms: ['same'] }),
      entry({ id: 'first', zh_preferred: '阿', canonical: 'same' }),
    ];
    expect(identities(searchGlossary(input))).toEqual([
      'ilyenkov/first', 'ilyenkov/c', 'hegel/a', 'hegel/b', 'spinoza/b',
    ]);
    expect(identities(searchGlossary(input, { query: 'same' }))).toEqual([
      'ilyenkov/first', 'hegel/a', 'hegel/b', 'spinoza/b', 'ilyenkov/c',
    ]);
    expect(compareGlossaryEntries(input[1]!, input[2]!)).toBeGreaterThan(0);
  });

  it.each(['', ' \n\t ', '　'])('returns stable browsing order for an empty query %s', (query) => {
    const input = [entry({ id: 'second', zh_preferred: '波' }), entry({ id: 'first', zh_preferred: '阿' })];
    expect(searchGlossary(input, { query }).map(({ id }) => id)).toEqual(['first', 'second']);
  });

  it('does not search explanations, identities, collection labels, categories or type labels', () => {
    const input = [entry({
      id: 'hidden-id',
      notes: 'explanation-only-sentinel',
      canonical: 'public term',
      zh_preferred: '公开译名',
      collection: 'glossary',
      type: 'person',
    })];
    for (const query of ['hidden-id', 'explanation-only-sentinel', 'glossary', '专名与体制词', '人名']) {
      expect(searchGlossary(input, { query })).toEqual([]);
    }
    expect(searchGlossary([entry()], { query: '伊里因科夫' })).toEqual([]);
  });

  it('returns an empty result for an unmatched term', () => {
    expect(searchGlossary(concepts, { query: 'nothing-matches' })).toEqual([]);
  });

  it('preserves source arrays, entry identities and authored text during projection, search and faceting', () => {
    const source = record({
      canonical: '  ＦＯＲＭ  ', forms: [' Other\tFORM '],
      zh_alternatives: [' 异译 '], notes: '  authored notes\n',
    });
    Object.freeze(source.forms);
    Object.freeze(source.zh_alternatives);
    Object.freeze(source);
    const projected = Object.freeze(toGlossaryEntry(source));
    const other = Object.freeze(entry({ id: 'other', zh_preferred: '阿' }));
    const input = Object.freeze([projected, other]);
    const before = JSON.stringify(input);

    const results = searchGlossary(input, { query: 'form' });
    searchGlossary(input);
    getGlossaryFacets(input);

    expect(results[0]).toBe(projected);
    expect(JSON.stringify(input)).toBe(before);
    expect(input[0]).toBe(projected);
    expect(projected.canonical).toBe('  ＦＯＲＭ  ');
    expect(projected.forms).toEqual([' Other\tFORM ']);
    expect(projected.zh_alternatives).toEqual([' 异译 ']);
    expect(projected.notes).toBe('  authored notes\n');
  });
});

describe('public glossary filters and facets', () => {
  const entries = [
    entry({ collection: 'ilyenkov', id: 'concept-a' }),
    entry({ collection: 'ilyenkov', id: 'concept-b', canonical: 'form', zh_preferred: '形式' }),
    entry({ collection: 'spinoza', id: 'concept-a' }),
    entry({ collection: 'terms', id: 'term' }),
    entry({ collection: 'glossary', id: 'person-a', type: 'person' }),
    entry({ collection: 'glossary', id: 'person-b', type: 'person' }),
    entry({ collection: 'glossary', id: 'work', type: 'work' }),
  ];

  it('combines the query, category, collection and name type as intersecting filters', () => {
    expect(identities(searchGlossary(entries, { category: 'concepts', collection: 'ilyenkov' }))).toEqual([
      'ilyenkov/concept-a', 'ilyenkov/concept-b',
    ]);
    expect(identities(searchGlossary(entries, { query: 'form', category: 'concepts', collection: 'ilyenkov' })))
      .toEqual(['ilyenkov/concept-b']);
    expect(identities(searchGlossary(entries, { query: 'идеальное', category: 'names', collection: 'glossary', type: 'person' })))
      .toEqual(['glossary/person-a', 'glossary/person-b']);
    expect(searchGlossary(entries, { type: 'work' }).map(({ id }) => id)).toEqual(['work']);
  });

  it('returns no entries for conflicting filters or absent collections and types', () => {
    expect(searchGlossary(entries, { category: 'concepts', type: 'person' })).toEqual([]);
    expect(searchGlossary(entries, { category: 'names', collection: 'ilyenkov' })).toEqual([]);
    expect(searchGlossary(entries, { collection: 'spinoza', type: 'work' })).toEqual([]);
    expect(searchGlossary(entries, { collection: 'absent-author' })).toEqual([]);
    expect(searchGlossary(entries, { type: 'journal' })).toEqual([]);
  });

  it('counts all three categories and only authors and name types represented in the input', () => {
    const facets = getGlossaryFacets(entries);
    expect(facets.categories).toEqual([
      { id: 'concepts', label: '作者理论概念', count: 3 },
      { id: 'terms', label: '通用学科术语', count: 1 },
      { id: 'names', label: '专名与体制词', count: 3 },
    ]);
    expect(facets.authors).toEqual([
      { id: 'spinoza', label: '斯宾诺莎', count: 1 },
      { id: 'ilyenkov', label: '伊里因科夫', count: 2 },
    ]);
    expect(facets.types).toEqual([
      { id: 'person', label: '人名', count: 2 },
      { id: 'work', label: '著作名', count: 1 },
    ]);
  });

  it('derives facets from the provided entries without filling absent authors or types', () => {
    expect(getGlossaryFacets(searchGlossary(entries, { collection: 'ilyenkov' }))).toEqual({
      categories: [
        { id: 'concepts', label: '作者理论概念', count: 2 },
        { id: 'terms', label: '通用学科术语', count: 0 },
        { id: 'names', label: '专名与体制词', count: 0 },
      ],
      authors: [{ id: 'ilyenkov', label: '伊里因科夫', count: 2 }],
      types: [],
    });
  });

  it('keeps zero-count categories when no public terms exist', () => {
    expect(getGlossaryFacets([])).toEqual({
      categories: [
        { id: 'concepts', label: '作者理论概念', count: 0 },
        { id: 'terms', label: '通用学科术语', count: 0 },
        { id: 'names', label: '专名与体制词', count: 0 },
      ],
      authors: [],
      types: [],
    });
  });

  it('facets unknown authors with their public labels and includes each supported name type when present', () => {
    const input = [
      entry({ collection: 'new-author' }),
      ...(['person', 'organization', 'institution', 'work', 'journal'] as const)
        .map((type) => entry({ collection: 'glossary', id: type, type })),
    ];
    expect(getGlossaryFacets(input).authors).toEqual([{ id: 'new-author', label: 'new-author', count: 1 }]);
    expect(getGlossaryFacets(input).types).toEqual([
      { id: 'person', label: '人名', count: 1 },
      { id: 'organization', label: '机构名', count: 1 },
      { id: 'institution', label: '体制词', count: 1 },
      { id: 'work', label: '著作名', count: 1 },
      { id: 'journal', label: '刊名', count: 1 },
    ]);
  });
});
