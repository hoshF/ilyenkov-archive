import { describe, expect, it } from 'vitest';
import { getGroupIssues } from '../src/lib/group';
import { collectLatestContent, getLatestContent, HOME_CONTENT_LIMIT } from '../src/lib/latest-content';
import { getSiteData } from '../src/lib/site-data';

describe('homepage latest content adapter', () => {
  it('supports different public work kinds and preserves source date precision and optional authors', () => {
    const articles = [
      { title: 'Alpha', route: '/archive/alpha-1', authorLabel: '作者丙', year: '2001' },
      { title: 'Alpha', route: '/archive/alpha-2', authorLabel: '作者甲', year: '2001' },
      { title: 'Beta', route: '/archive/beta', authorLabel: '作者乙', year: '2001' },
      { title: '旧文', route: '/archive/older', authorLabel: '原文作者', year: '1977' },
    ];
    const issues = [
      { title: '公开资料', route: '/group/2', kind: '资料', published: '2026-10-02' },
      { title: '公开研究', route: '/group/4', kind: '研究', published: '2026-10-04' },
      { title: '公开会议记录', route: '/group/3', kind: '会议记录', published: '2026-10-03' },
    ];
    const articleSnapshot = structuredClone(articles);
    const issueSnapshot = structuredClone(issues);
    const entries = collectLatestContent(articles, issues);

    expect(entries.map((entry) => entry.href)).toEqual([
      '/group/4', '/group/3', '/group/2',
      '/archive/alpha-1', '/archive/alpha-2', '/archive/beta', '/archive/older',
    ]);
    expect(entries.slice(0, 3).map((entry) => entry.type)).toEqual(['研究', '会议记录', '资料']);
    for (const entry of entries.slice(0, 3)) {
      expect(entry).not.toHaveProperty('author');
      expect(entry.dateLabel).toBe('公开日期');
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(entries[3]).toEqual({
      type: '译文', title: 'Alpha', href: '/archive/alpha-1',
      author: '作者丙', date: '2001', dateLabel: '原文年份',
    });
    for (const entry of entries.slice(3)) {
      expect(entry.dateLabel).toBe('原文年份');
      expect(entry.date).toMatch(/^\d{4}$/);
    }

    // 聚合排序不改写规范文章顺序或小组源记录。
    expect(articles).toEqual(articleSnapshot);
    expect(issues).toEqual(issueSnapshot);
    expect(collectLatestContent(articles, [...issues].reverse())).toEqual(entries);
  });

  it('prioritizes known website publication dates and retains archive order for undated translations', () => {
    // 原文年份再晚也不是本站公开日期；适配器保留上游档案顺序。
    const articles = [
      { title: '档案首项', route: '/archive/first', authorLabel: '作者甲', year: '1977' },
      { title: '档案次项', route: '/archive/second', authorLabel: '作者乙', year: '2099' },
    ];
    const issues = [
      { title: '早期公开成果', route: '/group/2', kind: '资料', published: '1970-01-01' },
      { title: '后来公开成果', route: '/group/1', kind: '研究', published: '2000-01-01' },
    ];
    const entries = collectLatestContent(articles, issues);

    expect(entries.map(({ href }) => href)).toEqual([
      '/group/1', '/group/2', '/archive/first', '/archive/second',
    ]);
    expect(entries.slice(2).map(({ date, dateLabel }) => ({ date, dateLabel }))).toEqual([
      { date: '1977', dateLabel: '原文年份' },
      { date: '2099', dateLabel: '原文年份' },
    ]);
  });

  it('derives every actual entry from existing public identities without carrying bodies or private fields', async () => {
    const [{ articles }, issues, entries] = await Promise.all([
      getSiteData(), getGroupIssues(), getLatestContent(),
    ]);
    expect(entries).toHaveLength(articles.length + issues.length);
    expect(new Set(entries.map((entry) => entry.href)).size).toBe(entries.length);
    expect(entries.slice(issues.length).map(({ href }) => href))
      .toEqual(articles.map(({ route }) => route));
    const byRoute = new Map(entries.map((entry) => [entry.href, entry]));

    for (const article of articles) {
      expect(byRoute.get(article.route)).toEqual({
        type: '译文', title: article.title, href: article.route,
        author: article.authorLabel, date: article.year, dateLabel: '原文年份',
      });
    }
    for (const issue of issues) {
      expect(byRoute.get(issue.route)).toEqual({
        type: issue.kind, title: issue.title, href: issue.route,
        date: issue.published, dateLabel: '公开日期',
      });
    }
    const allowedFields = new Set(['type', 'title', 'href', 'author', 'date', 'dateLabel']);
    for (const entry of entries) {
      expect(Object.keys(entry).every((key) => allowedFields.has(key))).toBe(true);
      for (const field of ['html', 'headings', 'sourceEdition', 'rights_status', 'source_text_status', 'source_path']) {
        expect(entry).not.toHaveProperty(field);
      }
    }
    expect(HOME_CONTENT_LIMIT).toBeGreaterThan(0);
    expect(HOME_CONTENT_LIMIT).toBeLessThanOrEqual(5);
  });
});
