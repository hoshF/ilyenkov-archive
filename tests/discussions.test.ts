import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { articleDiscussions, DiscussionsSchema } from '../src/lib/discussions';
import { readEditorialJson, site } from '../src/lib/editorial';
import { getSiteData } from '../src/lib/site-data';
import { builtRoutePath } from './helpers/pages';

const forumUrl = 'https://forum.example.test/';

describe('article discussion annotations', () => {
  it('derives the topic address from the forum base and labels the two relations', () => {
    const discussions = articleDiscussions(['first-article', 'second-article', 'quiet-article'], {
      'first-article': { topicId: 12, relation: 'article' },
      'second-article': { topicId: 7, relation: 'related' },
    }, forumUrl);
    expect(discussions.get('first-article')).toEqual({ href: 'https://forum.example.test/t/12', label: '讨论本文' });
    expect(discussions.get('second-article')).toEqual({ href: 'https://forum.example.test/t/7', label: '相关讨论' });
    expect(discussions.has('quiet-article')).toBe(false);
    // 论坛迁到子路径时只改基址。
    expect(articleDiscussions(['first-article'], { 'first-article': { topicId: 12, relation: 'article' } }, 'https://example.org/forum/')
      .get('first-article')!.href).toBe('https://example.org/forum/t/12');
  });

  it.each([
    ['a zero topic id', { a: { topicId: 0, relation: 'article' } }],
    ['a fractional topic id', { a: { topicId: 1.5, relation: 'article' } }],
    ['a string topic id', { a: { topicId: '12', relation: 'article' } }],
    ['an unknown relation', { a: { topicId: 12, relation: 'mentions' } }],
    ['a stored forum title', { a: { topicId: 12, relation: 'article', title: '论坛标题' } }],
    ['several topics for one article', { a: [{ topicId: 12, relation: 'article' }] }],
    ['a page path instead of an article id', { '/archive/a/': { topicId: 12, relation: 'article' } }],
  ])('rejects %s', (_case, source) => {
    expect(DiscussionsSchema.safeParse(source).success).toBe(false);
  });

  it('fails the build on an annotation for an article that is not published', () => {
    expect(() => articleDiscussions(['published'], { withdrawn: { topicId: 3, relation: 'related' } }, forumUrl))
      .toThrow(/not published; remove these stale entries: withdrawn/);
  });

  it('accepts the committed annotations for the current public articles', async () => {
    const { articles } = await getSiteData();
    expect(() => articleDiscussions(articles.map(({ id }) => id))).not.toThrow();
  });
});

describe('article discussion link on built pages', () => {
  it('shows the link after the article and before the archive navigation only when an article has a topic', async () => {
    const { articles } = await getSiteData();
    const discussions = articleDiscussions(articles.map(({ id }) => id));
    const annotations = DiscussionsSchema.parse(readEditorialJson('discussions.json'));
    const rss = readFileSync(builtRoutePath('/rss.xml'), 'utf8');
    expect(rss).not.toContain(site.forumUrl);
    for (const article of articles) {
      const html = readFileSync(builtRoutePath(article.route), 'utf8');
      const main = html.match(/<main>([\s\S]*?)<\/main>/)![1];
      const discussion = discussions.get(article.id);
      if (!discussion) {
        // 没有关联就没有任何讨论区域。
        expect(main, article.id).not.toContain('document-discussion');
        expect(main, article.id).not.toContain(site.forumUrl);
        continue;
      }
      const link = `<p class="document-discussion"><a href="${discussion.href}">${discussion.label}<span aria-hidden="true"> ↗</span></a></p>`;
      expect(main, article.id).toContain(link);
      expect(discussion.href).toBe(new URL(`t/${annotations[article.id].topicId}`, site.forumUrl).href);
      // 位置：全文与原文信息之后、篇末导航之前；不在搜索正文或页内目录里。
      const at = main.indexOf(link);
      expect(at, article.id).toBeGreaterThan(main.lastIndexOf('</article>'));
      expect(at, article.id).toBeLessThan(main.indexOf('<nav class="document-nav"'));
      for (const indexed of main.matchAll(/<(header|article) data-pagefind-body[\s\S]*?<\/\1>/g)) {
        expect(indexed[0], article.id).not.toContain(site.forumUrl);
      }
      const toc = main.match(/<aside class="section-layout__toc">[\s\S]*?<\/aside>/)?.[0] ?? '';
      expect(toc, article.id).not.toContain(discussion.label);
    }
  });
});
