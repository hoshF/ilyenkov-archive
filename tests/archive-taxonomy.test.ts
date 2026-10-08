import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertTaxonomyCoversArticles,
  getArchiveTaxonomy,
} from '../src/lib/archive-taxonomy';
import { getSiteData } from '../src/lib/site-data';

/**
 * Archive 编辑分类的契约：词表受控、指派完整、引用有效、与公开文章集合完全一致。
 * 具体某篇归入哪个主题属于编辑数据，这里不复制一遍 JSON，只验证行为。
 */

describe('archive taxonomy', () => {
  it('resolves every assignment to a controlled term with an id and a label', async () => {
    const taxonomy = getArchiveTaxonomy();
    expect(taxonomy.size).toBeGreaterThan(0);

    for (const [articleId, assignment] of taxonomy) {
      for (const term of [...assignment.topics, ...assignment.persons]) {
        expect(term.id, `${articleId} term id`).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        expect(term.label.trim().length, `${articleId} term label`).toBeGreaterThan(0);
      }
    }
  });

  it('covers exactly the published archive articles, with no missing or stale assignment', async () => {
    const { articles } = await getSiteData();
    const published = articles.map((article) => article.id).sort();
    const taxonomy = getArchiveTaxonomy();

    expect([...taxonomy.keys()].sort()).toEqual(published);
    // 构建期同一条校验；不通过时加载文章就会抛错。
    expect(() => assertTaxonomyCoversArticles(published)).not.toThrow();
  });

  it('fails closed when an article has no assignment or an assignment is stale', async () => {
    const { articles } = await getSiteData();
    const published = articles.map((article) => article.id).sort();

    // 新文章进入 website_public 而 taxonomy 未补 → 构建必须失败。
    expect(() => assertTaxonomyCoversArticles([...published, 'a-brand-new-article']))
      .toThrow(/missing assignment: a-brand-new-article/);

    // 文章撤销公开或改名而 taxonomy 留下旧记录 → 构建也必须失败。
    const [first] = published;
    expect(() => assertTaxonomyCoversArticles(published.slice(1)))
      .toThrow(new RegExp(`no longer published: ${first}`));
  });

  it('keeps the first version of the vocabulary scoped and free of single-use terms', async () => {
    const taxonomy = getArchiveTaxonomy();
    const topics = new Set([...taxonomy.values()].flatMap((a) => a.topics.map((t) => t.id)));
    const persons = new Set([...taxonomy.values()].flatMap((a) => a.persons.map((p) => p.id)));

    // 词表是编辑决策：只有确定在用的主题与人物才留在受控表里。
    expect([...topics].sort()).toEqual([
      'dialectics',
      'education',
      'ideal',
      'psychology',
      'soviet-philosophy',
    ]);
    expect([...persons].sort()).toEqual(['spinoza', 'vygotsky']);
  });

  it('assigns a defensible number of terms per article', async () => {
    const { articles } = await getSiteData();

    for (const article of articles) {
      expect(article.topics.length, `${article.id} topics`).toBeLessThanOrEqual(3);
      expect(article.persons.length, `${article.id} persons`).toBeLessThanOrEqual(2);
      // 词表里的 id 唯一，一篇之内不得重复。
      expect(new Set(article.topics.map((t) => t.id)).size).toBe(article.topics.length);
      expect(new Set(article.persons.map((p) => p.id)).size).toBe(article.persons.length);
    }

    // 受控分类的价值来自准确，不来自覆盖率：允许某篇没有任何主题。
    expect(articles.some((article) => article.topics.length === 0)).toBe(true);
    expect(articles.some((article) => article.topics.length > 0)).toBe(true);
  });

  it('projects existing taxonomy identities into article search filters', async () => {
    const { articles } = await getSiteData();
    for (const article of articles) {
      const html = readFileSync(path.join(process.cwd(), 'dist', 'archive', article.id, 'index.html'), 'utf8');
      for (const term of article.topics) expect(html).toContain(`data-pagefind-filter="topic:${term.id}"`);
      for (const term of article.persons) expect(html).toContain(`data-pagefind-filter="person:${term.id}"`);
    }
  });
});
