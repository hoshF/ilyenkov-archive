import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { buildCache } from './cache';

/**
 * Archive 的受控编辑分类。
 *
 * 这是 public 仓库自己维护的正式编辑数据，与 editorial/books/、editorial/group/ 同一所有权层：
 * 不经过 private 同步通道，也不进入 .website-input/。它回答的是"这篇关于什么、主要研究谁"，
 * 属于站点的浏览分类，而题名、作者、年份、来源那些文献事实来自 private 的 website_public 选择。
 */

const taxonomyPath = path.join(process.cwd(), 'editorial', 'archive-taxonomy.json');
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const TermSchema = z.object({
  label: z.string().trim().min(1),
}).strict();

const AssignmentSchema = z.object({
  topics: z.array(z.string().regex(idPattern)).default([]),
  persons: z.array(z.string().regex(idPattern)).default([]),
}).strict();

const ArchiveTaxonomySchema = z.object({
  topics: z.record(z.string().regex(idPattern), TermSchema),
  persons: z.record(z.string().regex(idPattern), TermSchema),
  articles: z.record(z.string().regex(idPattern), AssignmentSchema),
}).strict();

export interface TaxonomyTerm {
  id: string;
  label: string;
}

/** 一篇文章的编辑分类，已解析成 id + 中文标签。 */
export interface ArticleTaxonomy {
  topics: TaxonomyTerm[];
  persons: TaxonomyTerm[];
}

export interface ArchiveTaxonomy {
  topics: TaxonomyTerm[];
  persons: TaxonomyTerm[];
}

/** 一个受控词条连同它在已公开文章里的命中数；count 是派生数据，不写进 taxonomy。 */
export interface TermWithArticles {
  id: string;
  label: string;
  href: string;
  count: number;
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => (seen.has(value) ? true : (seen.add(value), false)));
}

function terms(vocabulary: Record<string, { label: string }>): TaxonomyTerm[] {
  return Object.entries(vocabulary)
    .map(([id, term]) => ({ id, label: term.label }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function resolve(
  ids: string[],
  vocabulary: TaxonomyTerm[],
  kind: 'topic' | 'person',
  articleId: string,
): TaxonomyTerm[] {
  const byId = new Map(vocabulary.map((term) => [term.id, term]));
  return ids.map((id) => {
    const term = byId.get(id);
    if (!term) {
      throw new Error(`Archive taxonomy: ${articleId} references an undefined ${kind} "${id}"`);
    }
    return term;
  });
}

/** 整份 taxonomy：词表加每篇的指派，全部解析成 id + label。 */
export const getArchiveTaxonomy = buildCache((): Map<string, ArticleTaxonomy> => {
  const manifest = ArchiveTaxonomySchema.parse(
    JSON.parse(readFileSync(taxonomyPath, 'utf8')),
  );
  const topicTerms = terms(manifest.topics);
  const personTerms = terms(manifest.persons);

  const resolved = new Map<string, ArticleTaxonomy>();
  for (const [articleId, assignment] of Object.entries(manifest.articles)) {
    for (const [kind, ids] of [['topic', assignment.topics], ['person', assignment.persons]] as const) {
      const repeated = duplicates(ids);
      if (repeated.length > 0) {
        throw new Error(`Archive taxonomy: ${articleId} repeats ${kind} ${repeated.join(', ')}`);
      }
    }
    resolved.set(articleId, {
      topics: resolve(assignment.topics, topicTerms, 'topic', articleId),
      persons: resolve(assignment.persons, personTerms, 'person', articleId),
    });
  }
  return resolved;
});

/** 词表本身（不含指派），供路由生成与页面渲染使用。 */
export const getArchiveVocabulary = buildCache((): ArchiveTaxonomy => {
  const manifest = ArchiveTaxonomySchema.parse(
    JSON.parse(readFileSync(taxonomyPath, 'utf8')),
  );
  return { topics: terms(manifest.topics), persons: terms(manifest.persons) };
});

interface ArticleVocabulary {
  id: string;
  topics: TaxonomyTerm[];
  persons: TaxonomyTerm[];
}

/** 带命中数的词表；结果只保留至少命中一篇文章的词条。 */
export function termsWithArticles(
  kind: 'topic' | 'person',
  vocabulary: TaxonomyTerm[],
  articles: ArticleVocabulary[],
): TermWithArticles[] {
  return vocabulary.flatMap((term) => {
    const count = articles.filter((article) => (
      (kind === 'topic' ? article.topics : article.persons).some((item) => item.id === term.id)
    )).length;
    if (count === 0) return [];
    return [{ id: term.id, label: term.label, href: `/archive/${kind}/${term.id}`, count }];
  });
}

/**
 * 受控词表里每个词条都必须真的有文章。0 篇的受控词条意味着 taxonomy 已 stale，或者编辑
 * 预先建了未来分类——两种都不该悄悄生成一个空页面。
 */
export function assertEveryTermHasArticles(
  articles: ArticleVocabulary[],
): { topics: TermWithArticles[]; persons: TermWithArticles[] } {
  const { topics, persons } = getArchiveVocabulary();
  const withTopics = termsWithArticles('topic', topics, articles);
  const withPersons = termsWithArticles('person', persons, articles);

  const empty = [
    ...topics.filter((term) => !withTopics.some((item) => item.id === term.id))
      .map((term) => `topic "${term.id}"`),
    ...persons.filter((term) => !withPersons.some((item) => item.id === term.id))
      .map((term) => `person "${term.id}"`),
  ];
  if (empty.length > 0) {
    throw new Error(`Archive taxonomy terms have no published articles: ${empty.join(', ')}`);
  }
  return { topics: withTopics, persons: withPersons };
}

/**
 * 分类必须与已公开的文章集合完全一致，两个方向都算错：文章没有指派，或者指派指向一篇
 * 已经不在网站上的文章。两者都会让构建失败，而不是静默略过。
 */
export function assertTaxonomyCoversArticles(articleIds: string[]): void {
  const taxonomy = getArchiveTaxonomy();
  const published = [...articleIds].sort();
  const assigned = [...taxonomy.keys()].sort();
  const missing = published.filter((id) => !taxonomy.has(id));
  const stale = assigned.filter((id) => !articleIds.includes(id));
  if (missing.length === 0 && stale.length === 0) return;

  throw new Error([
    'Archive taxonomy does not match the published articles',
    missing.length > 0 ? `missing assignment: ${missing.join(', ')}` : null,
    stale.length > 0 ? `no longer published: ${stale.join(', ')}` : null,
  ].filter(Boolean).join('; '));
}
