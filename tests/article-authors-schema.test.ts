import { readFileSync } from 'node:fs';
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import { getArchiveTaxonomy } from '../src/lib/archive-taxonomy';
import { resolveGeneratedArticlePath } from '../src/lib/article-source';
import { GeneratedArticleSchema, getSiteData } from '../src/lib/site-data';

const article = {
  title: 'An article',
  title_zh: '一篇译文',
  author: ['作者甲', '作者乙'],
  author_ids: ['person-author-a', 'person-author-b'],
  year: '2000',
  source_edition: 'Source edition',
  type: 'translation',
  generated_from: 'Ilyenkov:translation/contributor/an-article.md',
};

describe('generated article author identity schema', () => {
  it('keeps display names and identity references in the same input order', () => {
    const parsed = GeneratedArticleSchema.parse(article);
    expect(parsed.author).toEqual(article.author);
    expect(parsed.author_ids).toEqual(article.author_ids);
  });

  it('requires the identity array alongside the existing display array', () => {
    const withoutIds: Record<string, unknown> = { ...article };
    delete withoutIds.author_ids;
    expect(GeneratedArticleSchema.safeParse(withoutIds).success).toBe(false);
    for (const author_ids of [null, 'person-author-a', [], ['', 'person-author-b'], ['  ', 'person-author-b'], [42, 'person-author-b']]) {
      expect(GeneratedArticleSchema.safeParse({ ...article, author_ids }).success).toBe(false);
    }
  });

  it('rejects duplicate identities even when their display names differ', () => {
    const result = GeneratedArticleSchema.safeParse({
      ...article,
      author_ids: ['person-author-a', 'person-author-a'],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(expect.objectContaining({
        path: ['author_ids'], message: 'Author IDs must be unique',
      }));
    }
  });

  it('rejects shorter or longer identity arrays', () => {
    for (const author_ids of [['person-author-a'], [...article.author_ids, 'person-author-c']]) {
      const result = GeneratedArticleSchema.safeParse({ ...article, author_ids });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toContainEqual(expect.objectContaining({
          path: ['author_ids'], message: 'Author IDs must align with author names',
        }));
      }
    }
  });
});

describe('readable article author identities', () => {
  it('exposes generated identities without changing display names or labels', async () => {
    const { articles } = await getSiteData();
    expect(articles.length).toBeGreaterThan(0);
    for (const article of articles) {
      const metadata = matter(readFileSync(resolveGeneratedArticlePath(article.id), 'utf8')).data;
      expect(article.author, article.id).toEqual(metadata.author);
      expect(article.authorIds, article.id).toEqual(metadata.author_ids);
      expect(article.authorIds, article.id).toHaveLength(article.author.length);
      expect(article.authorLabel, article.id).toBe(article.author.join('、'));
    }
  });

  it('keeps editorial persons assignments independent of author identities', async () => {
    const { articles } = await getSiteData();
    const taxonomy = getArchiveTaxonomy();
    for (const article of articles) {
      expect(article.persons, article.id).toEqual(taxonomy.get(article.id)?.persons ?? []);
    }
    expect(articles.some(({ persons }) => persons.length === 0)).toBe(true);
    expect(articles.some(({ persons }) => persons.length > 0)).toBe(true);
  });
});
