import { readFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { getRssString, type RSSFeedItem } from '@astrojs/rss';
import type { APIContext } from 'astro';
import { describe, expect, it } from 'vitest';
import astroConfig from '../astro.config.mjs';
import { site } from '../src/lib/editorial';
import { getGroupIssues } from '../src/lib/group';
import { collectRssItems, getRssItems } from '../src/lib/rss';
import { getUpdates, type Update } from '../src/lib/updates';
import { GET } from '../src/pages/rss.xml';
import { builtRoutePath, pageFileExists, routeExists } from './helpers/pages';

const siteUrl = new URL(astroConfig.site!);
const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  parseAttributeValue: false,
  isArray: (name) => name === 'item',
});

interface ParsedItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: { '#text': string; '@_isPermaLink': string };
}

interface ParsedFeed {
  rss: {
    '@_version': string;
    channel: { title: string; description: string; link: string; item?: ParsedItem[] };
  };
}

const parseFeed = (xml: string): ParsedFeed => parser.parse(xml, true) as ParsedFeed;
const publicationDate = (item: RSSFeedItem): string => new Date(String(item.pubDate)).toISOString().slice(0, 10);
const itemGuid = (item: RSSFeedItem): string => (
  parser.parse(`<entry>${item.customData}</entry>`).entry.guid['#text'] as string
);
const renderFeed = (items: RSSFeedItem[]): Promise<string> => getRssString({
  title: site.name,
  description: `${site.name}的近期公开内容与工作动态。`,
  site: siteUrl,
  items,
  trailingSlash: true,
});

const issue = {
  title: '公开研究 A & B',
  kind: '研究',
  route: '/group/20/',
  published: '2024-03-04',
  summary: '公开摘要：文本 <资料> 与研究。',
};

describe('public RSS feed', () => {
  it('orders confirmed publication dates and update dates without adding inferred dates', () => {
    const issues = [
      { ...issue, published: '2020-01-02' },
      { ...issue, title: '另一份公开研究', route: '/group/21/', published: '2024-03-04' },
    ];
    const updates = [{ date: '2023-02-03', summary: '整理工作的公开变化。' }];
    const originals = structuredClone({ issues, updates });
    const items = collectRssItems(issues, updates, siteUrl);
    expect(items.map(publicationDate)).toEqual(['2024-03-04', '2023-02-03', '2020-01-02']);
    expect({ issues, updates }).toEqual(originals);
    expect(collectRssItems([], [], siteUrl)).toEqual([]);
  });

  it('rejects absent precision and impossible dates rather than normalizing them', () => {
    for (const date of ['1977', '2026-02-29', '2026-04-31', '2026-13-01']) {
      expect(() => collectRssItems([{ ...issue, published: date }], [], siteUrl), date).toThrow();
      expect(() => collectRssItems([], [{ date, summary: '公开变化。' }], siteUrl), date).toThrow();
    }
  });

  it('prefers content over its same-day announcement while preserving later updates', () => {
    for (const link of [
      issue.route,
      issue.route.replace(/\/$/, ''),
      `${issue.route}?view=reader#intro`,
      new URL(`${issue.route}?view=reader#intro`, siteUrl).href,
    ]) {
      const updates = [
        { date: issue.published, summary: '同一成果的发布动态。', link },
        { date: '2024-03-05', summary: '同一成果后续的公开变化。', link },
      ];
      const items = collectRssItems([issue], updates, siteUrl);
      expect(items.map(publicationDate), link).toEqual(['2024-03-05', issue.published]);
      expect(items.some((item) => item.description?.includes('同一成果的发布动态')), link).toBe(false);
      expect(items.some((item) => item.description?.includes(issue.summary)), link).toBe(true);
      expect(items.some((item) => item.description?.includes('后续的公开变化')), link).toBe(true);
    }
  });

  it('uses public site destinations and sends external or unlinked updates to the stream', () => {
    const updates: Update[] = [
      { date: '2024-03-04', summary: '没有独立正文的变化。' },
      { date: '2024-03-03', summary: '有外部来源的变化。', link: 'https://example.org/source' },
      { date: '2024-03-02', summary: '文本档案变化。', link: '/archive/' },
      { date: '2024-03-01', summary: '小组记录变化。', link: new URL('/group/20/', siteUrl).href },
    ];
    const items = collectRssItems([], updates, siteUrl);
    expect(items.map((item) => item.link)).toEqual([
      new URL('/updates/', siteUrl).href,
      new URL('/updates/', siteUrl).href,
      new URL('/archive/', siteUrl).href,
      new URL('/group/20/', siteUrl).href,
    ]);
    for (const item of items) {
      expect(new URL(item.link!).origin).toBe(siteUrl.origin);
    }
  });

  it('gives shared stream destinations independent, stable GUIDs without array indices', async () => {
    const updates: Update[] = [
      { date: '2024-03-06', summary: '第一项公开变化。' },
      { date: '2024-03-06', summary: '第二项公开变化。' },
      { date: '2024-03-05', summary: '前一天公开变化。' },
    ];
    const original = collectRssItems([issue], updates, siteUrl);
    const expanded = collectRssItems([issue], [
      { date: '2024-03-07', summary: '后来新增的公开变化。' },
      ...updates.toReversed(),
    ], siteUrl);
    for (const item of original) {
      const matching = expanded.find((candidate) => (
        candidate.title === item.title && candidate.description === item.description
          && candidate.link === item.link && publicationDate(candidate) === publicationDate(item)
      ));
      expect(matching).toBeDefined();
      expect(itemGuid(matching!)).toBe(itemGuid(item));
    }
    expect(new Set(original.map(itemGuid)).size).toBe(original.length);
    const moved = collectRssItems([issue], updates, new URL('https://example.org/'));
    expect(moved.map(itemGuid)).toEqual(original.map(itemGuid));
    expect(collectRssItems([], [...updates, updates[0]], siteUrl)).toHaveLength(updates.length);

    const parsed = parseFeed(await renderFeed(original));
    for (const item of parsed.rss.channel.item!) {
      expect(item.guid['@_isPermaLink']).toBe('false');
      expect(item.guid['#text']).not.toBe(item.link);
    }
  });

  it('escapes public summaries and excludes original years, full bodies and private metadata', async () => {
    const input = {
      ...issue,
      html: '<p>RESTRICTED_STUDY_TEXT</p>',
      original_year: '2099',
      source_path: '/private/research/source.md',
      rights_status: 'restricted',
    };
    const items = collectRssItems([input], [], siteUrl);
    for (const item of items) {
      expect(Object.keys(item).sort()).toEqual(['customData', 'description', 'link', 'pubDate', 'title']);
      expect(publicationDate(item)).toBe(issue.published);
    }
    const xml = await renderFeed(items);
    const parsed = parseFeed(xml).rss.channel.item![0];
    expect(parsed.title).toContain(issue.title);
    expect(parsed.description).toContain(issue.summary);
    expect(xml).not.toMatch(/content:encoded|RESTRICTED_STUDY_TEXT|2099|source_path|rights_status|\/private\/research/);
  });

  it('builds a valid static RSS endpoint from the shared public sources with an XML response', async () => {
    expect(pageFileExists('rss.xml.ts')).toBe(true);
    expect(routeExists('/rss.xml')).toBe(true);
    const xml = readFileSync(builtRoutePath('/rss.xml'), 'utf8');
    const feed = parseFeed(xml);
    expect(feed.rss['@_version']).toBe('2.0');
    expect(feed.rss.channel.title).toBe(site.name);
    expect(feed.rss.channel.description).toBe(`${site.name}的近期公开内容与工作动态。`);
    expect(new URL(feed.rss.channel.link).origin).toBe(siteUrl.origin);

    const [issues, updates, items] = await Promise.all([getGroupIssues(), getUpdates(), getRssItems(siteUrl)]);
    expect(items).toEqual(collectRssItems(issues, updates, siteUrl));
    const output = feed.rss.channel.item ?? [];
    expect(output).toHaveLength(items.length);
    expect(output.map(({ pubDate }) => new Date(pubDate).getTime()))
      .toEqual(output.map(({ pubDate }) => new Date(pubDate).getTime()).sort((left, right) => right - left));
    const confirmedDates = new Set([...issues.map(({ published }) => published), ...updates.map(({ date }) => date)]);
    output.forEach((item, index) => {
      expect(confirmedDates.has(new Date(item.pubDate).toISOString().slice(0, 10))).toBe(true);
      expect(item.title).toBe(items[index].title);
      expect(item.description).toBe(items[index].description);
      expect(item.link).toBe(items[index].link);
      expect(item.guid['#text']).toBe(itemGuid(items[index]));
      expect(item.guid['@_isPermaLink']).toBe('false');
      expect(new URL(item.link).origin).toBe(siteUrl.origin);
      expect(readFileSync(builtRoutePath(new URL(item.link).pathname), 'utf8').length).toBeGreaterThan(0);
    });
    expect(new Set(output.map(({ guid }) => guid['#text'])).size).toBe(output.length);
    expect(xml).not.toMatch(/content:encoded|source_path|rights_status|file:\/\/|<script\b/);

    const response = await GET({ site: siteUrl } as APIContext);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/^application\/xml(?:;|$)/);
    expect(await response.text()).toBe(xml);
  });

  it('offers RSS from contact and footer and advertises the same feed in document heads', () => {
    const contact = readFileSync(builtRoutePath('/contact'), 'utf8');
    const main = contact.match(/<main>([\s\S]*?)<\/main>/)![1];
    expect(main).toMatch(/<a\b[^>]*href="\/rss\.xml"[^>]*>[^<]*RSS[^<]*<\/a>/);

    for (const route of ['/', '/contact', '/group/', '/updates']) {
      const html = readFileSync(builtRoutePath(route), 'utf8');
      const head = html.match(/<head>([\s\S]*?)<\/head>/)![1];
      const discoveries = [...head.matchAll(/<link\b[^>]*>/g)]
        .map(([tag]) => tag).filter((tag) => tag.includes('rel="alternate"'));
      expect(discoveries, route).toHaveLength(1);
      expect(discoveries[0], route).toContain('type="application/rss+xml"');
      expect(discoveries[0], route).toContain(`href="${new URL('/rss.xml', siteUrl).href}"`);
      expect(discoveries[0], route).toContain(`title="${site.name} RSS"`);
      const footer = html.match(/<footer class="site-footer">([\s\S]*?)<\/footer>/)![1];
      expect(footer, route).toMatch(/<a\b[^>]*href="\/rss\.xml"[^>]*>RSS<\/a>/);
    }
  });
});
