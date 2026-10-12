import type { z } from 'zod';
import type { GeneratedGlossaryRecordSchema } from './glossary-record.mjs';

export type GeneratedGlossaryEntry = z.infer<typeof GeneratedGlossaryRecordSchema>;

export const GLOSSARY_CATEGORIES = ['concepts', 'terms', 'names'] as const;
export type GlossaryCategory = typeof GLOSSARY_CATEGORIES[number];

export const GLOSSARY_CATEGORY_LABELS = {
  concepts: '作者理论概念',
  terms: '通用学科术语',
  names: '专名与体制词',
} as const satisfies Record<GlossaryCategory, string>;

export const NAME_TYPE_LABELS = {
  person: '人名',
  organization: '机构名',
  institution: '体制词',
  work: '著作名',
  journal: '刊名',
} as const;
export type GlossaryNameType = keyof typeof NAME_TYPE_LABELS;

export const GLOSSARY_AUTHOR_LABELS: Readonly<Record<string, string>> = {
  ilyenkov: '伊里因科夫',
  hegel: '黑格尔',
  kedrov: '凯德洛夫',
  maidansky: '迈丹斯基',
  mikhailov: '米哈伊洛夫',
  spinoza: '斯宾诺莎',
  vygotsky: '维果茨基',
};

export type GlossaryEntry = GeneratedGlossaryEntry & {
  category: GlossaryCategory;
  categoryLabel: string;
  collectionLabel: string;
  route: string;
};

export type GlossarySearchEntry = Pick<GlossaryEntry,
  'collection' | 'id' | 'canonical' | 'forms' | 'zh_preferred' | 'zh_alternatives'
  | 'category' | 'type' | 'route'
>;

export function toGlossaryEntry(record: GeneratedGlossaryEntry): GlossaryEntry {
  const category: GlossaryCategory = record.collection === 'glossary'
    ? 'names'
    : record.collection === 'terms' ? 'terms' : 'concepts';

  return {
    ...record,
    category,
    categoryLabel: GLOSSARY_CATEGORY_LABELS[category],
    collectionLabel: category === 'concepts'
      ? (Object.hasOwn(GLOSSARY_AUTHOR_LABELS, record.collection)
        ? GLOSSARY_AUTHOR_LABELS[record.collection]!
        : record.collection)
      : GLOSSARY_CATEGORY_LABELS[category],
    route: `/glossary/${record.collection}/${record.id}/`,
  };
}

export function compareGlossaryEntries(left: GlossarySearchEntry, right: GlossarySearchEntry): number {
  return left.zh_preferred.localeCompare(right.zh_preferred, 'zh-Hans-CN')
    || left.canonical.localeCompare(right.canonical, 'zh-Hans-CN')
    || left.collection.localeCompare(right.collection, 'en')
    || left.id.localeCompare(right.id, 'en');
}

export type GlossarySearchOptions = {
  query?: string;
  category?: GlossaryCategory;
  collection?: string;
  type?: GlossaryNameType;
};

function normalizedSearchText(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
}

function fieldMatchRank(value: string, query: string): number {
  const normalized = normalizedSearchText(value);
  if (normalized === query) return 0;
  if (normalized.startsWith(query)) return 1;
  if (normalized.includes(query)) return 2;
  return Infinity;
}

function entryMatchRank(entry: GlossarySearchEntry, query: string): number {
  const primaryRank = Math.min(
    fieldMatchRank(entry.zh_preferred, query),
    fieldMatchRank(entry.canonical, query),
  );
  if (Number.isFinite(primaryRank)) return primaryRank;

  const otherRank = Math.min(
    ...entry.zh_alternatives.map((value) => fieldMatchRank(value, query)),
    ...entry.forms.map((value) => fieldMatchRank(value, query)),
  );
  return otherRank + 3;
}

export function searchGlossary<Entry extends GlossarySearchEntry>(
  entries: readonly Entry[],
  { query = '', category, collection, type }: GlossarySearchOptions = {},
): Entry[] {
  const filtered = entries.filter((entry) => (
    (category === undefined || entry.category === category)
    && (collection === undefined || entry.collection === collection)
    && (type === undefined || (entry.category === 'names' && entry.type === type))
  ));
  const normalizedQuery = normalizedSearchText(query);
  if (!normalizedQuery) return filtered.sort(compareGlossaryEntries);

  return filtered.map((entry) => ({ entry, rank: entryMatchRank(entry, normalizedQuery) }))
    .filter(({ rank }) => Number.isFinite(rank))
    .sort((left, right) => left.rank - right.rank || compareGlossaryEntries(left.entry, right.entry))
    .map(({ entry }) => entry);
}

export type GlossaryFacet<Id extends string = string> = {
  id: Id;
  label: string;
  count: number;
};

export type GlossaryFacets = {
  categories: GlossaryFacet<GlossaryCategory>[];
  authors: GlossaryFacet[];
  types: GlossaryFacet<GlossaryNameType>[];
};

export function getGlossaryFacets(entries: readonly GlossaryEntry[]): GlossaryFacets {
  const categoryCounts = new Map<GlossaryCategory, number>();
  const authors = new Map<string, GlossaryFacet>();
  const typeCounts = new Map<GlossaryNameType, number>();

  for (const entry of entries) {
    categoryCounts.set(entry.category, (categoryCounts.get(entry.category) ?? 0) + 1);
    if (entry.category === 'concepts') {
      const author = authors.get(entry.collection);
      if (author) author.count += 1;
      else authors.set(entry.collection, {
        id: entry.collection,
        label: entry.collectionLabel,
        count: 1,
      });
    }
    if (entry.category === 'names' && entry.type) {
      typeCounts.set(entry.type, (typeCounts.get(entry.type) ?? 0) + 1);
    }
  }

  return {
    categories: GLOSSARY_CATEGORIES.map((id) => ({
      id,
      label: GLOSSARY_CATEGORY_LABELS[id],
      count: categoryCounts.get(id) ?? 0,
    })),
    authors: [...authors.values()].sort((left, right) => (
      left.label.localeCompare(right.label, 'zh-Hans-CN') || left.id.localeCompare(right.id, 'en')
    )),
    types: (Object.keys(NAME_TYPE_LABELS) as GlossaryNameType[])
      .filter((id) => typeCounts.has(id))
      .map((id) => ({ id, label: NAME_TYPE_LABELS[id], count: typeCounts.get(id)! })),
  };
}
