import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { describe, expect, it } from 'vitest';
import config from '../astro.config.mjs';

const root = new URL('../dist/', import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const parser = new XMLParser();
const array = <T>(value: T | T[]): T[] => Array.isArray(value) ? value : [value];
const pages = (path = ''): string[] => readdirSync(join(root, path), { withFileTypes: true })
  .flatMap((entry) => entry.isDirectory() ? pages(join(path, entry.name))
    : entry.name.endsWith('.html') ? [join(path, entry.name)] : []);
const attributes = (tag: string) => Object.fromEntries(
  [...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]),
);

describe('static discoverability', () => {
  it('uses the production domain across all page metadata and RSS', () => {
    expect(config.site).toBe('https://ilyenkov.cn/');
    for (const path of pages().filter((path) => path !== 'research/researchers/index.html')) {
      const head = read(path).match(/<head>([\s\S]*?)<\/head>/)![1];
      const tags = [...head.matchAll(/<(?:meta|link)\b[^>]*>/g)].map(([tag]) => attributes(tag));
      const meta = (key: string) => tags.find((tag) => tag.property === key || tag.name === key)?.content;
      const canonical = tags.filter((tag) => tag.rel === 'canonical');
      if (path === '404.html') {
        expect(canonical).toHaveLength(0);
        expect(meta('robots')).toBe('noindex');
        continue;
      }
      expect(canonical, path).toHaveLength(1);
      const url = new URL(canonical[0].href);
      expect(url.origin).toBe('https://ilyenkov.cn');
      expect(url.search + url.hash).toBe('');
      expect(meta('og:url')).toBe(url.href);
      expect(meta('og:title')).toBe(head.match(/<title>(.*?)<\/title>/)![1]);
      expect(meta('og:description')).toBe(meta('description'));
      expect(meta('twitter:title')).toBe(meta('og:title'));
      expect(meta('twitter:description')).toBe(meta('og:description'));
      expect(meta('twitter:card')).toBe('summary');
      const image = new URL(meta('og:image')!);
      expect(image.origin).toBe(url.origin);
      expect(existsSync(join(root, image.pathname))).toBe(true);
      expect(meta('twitter:image')).toBe(image.href);
      expect(meta('og:type')).toBe(/^archive\/[^/]+\/index\.html$/.test(path) ? 'article' : 'website');
    }
    const channel = parser.parse(read('rss.xml')).rss.channel;
    expect(new URL(channel.link).origin).toBe('https://ilyenkov.cn');
    for (const item of array(channel.item)) expect(new URL(item.link).origin).toBe('https://ilyenkov.cn');
  });

  it('offers an agent guide whose links resolve to public build outputs', () => {
    const guide = read('llms.txt');
    expect(guide).toMatch(/^# .+\n\n> /);
    const links = [...guide.matchAll(/\]\((https:\/\/[^)]+)\)/g)].map((match) => new URL(match[1]));
    expect(links.length).toBeGreaterThan(0);
    for (const url of links) {
      expect(url.origin).toBe(new URL(config.site!).origin);
      const file = url.pathname.includes('.') ? url.pathname : `${url.pathname}/index.html`;
      expect(existsSync(join(root, file)), url.href).toBe(true);
    }
    for (const path of pages().filter((path) => !['404.html', 'research/researchers/index.html'].includes(path))) {
      const head = read(path).match(/<head>([\s\S]*?)<\/head>/)![1];
      const links = [...head.matchAll(/<link\b[^>]*>/g)].map(([tag]) => attributes(tag));
      expect(links.find((link) => link.rel === 'describedby')?.href).toBe(new URL('/llms.txt', config.site).href);
    }
  });

  it('publishes a robots-discoverable sitemap of actual indexable HTML routes', () => {
    const robots = read('robots.txt');
    expect(robots).toContain('User-agent: *\nAllow: /');
    expect(robots).toContain('Content-Signal: search=yes, ai-input=yes, ai-train=no');
    const indexUrl = new URL(robots.match(/^Sitemap: (.+)$/m)![1]);
    expect(indexUrl.origin).toBe('https://ilyenkov.cn');
    const index = parser.parse(read(indexUrl.pathname)).sitemapindex;
    const locations = array(index.sitemap).flatMap((sitemap: { loc: string }) => {
      const url = new URL(sitemap.loc);
      expect(url.origin).toBe(indexUrl.origin);
      return array(parser.parse(read(url.pathname)).urlset.url).map((entry: { loc: string }) => entry.loc);
    });
    const expected = pages().filter((path) => !['404.html', 'research/researchers/index.html'].includes(path)).map((path) => {
      // trailingSlash: 'always' —— 目录页在 sitemap 中同样带尾斜杠。
      const pathname = path === 'index.html' ? '/'
        : path.endsWith('/index.html') ? `/${path.slice(0, -'/index.html'.length)}/`
          : `/${path}`;
      return new URL(pathname, config.site).href;
    });
    expect(locations.toSorted()).toEqual(expected.toSorted());
    expect(new Set(locations).size).toBe(locations.length);
  });

  it('publishes schema.org JSON-LD for the site, the page and the page entity', () => {
    type Graph = Array<Record<string, unknown>>;
    const blocks = (path: string, scope: 'head' | 'document'): Graph[] => {
      const html = read(path);
      const source = scope === 'head' ? html.match(/<head>([\s\S]*?)<\/head>/)![1] : html;
      return [...source.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
        .map((match) => {
          // 序列化时 <、>、& 必须转义，否则脚本会被正文里的文字提前闭合。
          expect(match[1]).not.toMatch(/[<>&]/);
          const parsed = JSON.parse(match[1]);
          expect(parsed['@context']).toBe('https://schema.org');
          return parsed['@graph'] as Graph;
        });
    };
    const headGraph = (path: string): Graph => {
      const [graph, ...rest] = blocks(path, 'head');
      expect(rest, path).toHaveLength(0);
      return graph!;
    };
    const entity = (path: string, type: string): Record<string, unknown> | undefined => (
      headGraph(path).find((node) => node['@type'] === type)
    );
    const canonicalOf = (path: string): string => {
      const head = read(path).match(/<head>([\s\S]*?)<\/head>/)![1];
      return attributes(head.match(/<link rel="canonical"[^>]*>/)![0]).href;
    };
    const h1Of = (path: string): string => {
      const match = read(path).match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
      return match ? match[1].replace(/<[^>]+>/g, '').trim() : '';
    };
    const indexable = pages().filter((path) => !['404.html', 'research/researchers/index.html'].includes(path));

    for (const path of indexable) {
      const graph = headGraph(path);
      const types = graph.map((node) => node['@type']);
      expect(types, path).toEqual(expect.arrayContaining(['Organization', 'WebSite', 'WebPage']));
      const page = graph.find((node) => node['@type'] === 'WebPage')!;
      expect(page.url, path).toBe(canonicalOf(path));
      expect(page.inLanguage).toBe('zh-CN');
      const organization = graph.find((node) => node['@type'] === 'Organization')!;
      const website = graph.find((node) => node['@type'] === 'WebSite')!;
      expect(String(organization['@id'])).toBe('https://ilyenkov.cn/#organization');
      expect(organization.sameAs).toBeUndefined();
      expect(String(website['@id'])).toBe('https://ilyenkov.cn/#website');
      expect(website.publisher).toEqual({ '@id': organization['@id'] });
      expect(page.isPartOf).toEqual({ '@id': website['@id'] });
    }

    expect(blocks('404.html', 'head')).toHaveLength(0);
    expect(blocks('404.html', 'document')).toHaveLength(0);

    // 译文页：题名、原文题名、作者与原文发表年份都直接来自发布输入。
    const articlePath = 'archive/reality-of-the-ideal/index.html';
    const article = entity(articlePath, 'ScholarlyArticle')!;
    expect(article.headline).toBe(h1Of(articlePath));
    expect(article.alternativeHeadline).toBe('Reality of the Ideal');
    expect(article.datePublished).toBeUndefined();
    expect(article.author).toEqual([{ '@type': 'Person', name: '安德烈·迈丹斯基' }]);
    expect(article.translationOfWork).toMatchObject({ name: 'Reality of the Ideal', datePublished: '2014' });
    expect(article.mainEntityOfPage).toEqual({ '@id': `${canonicalOf(articlePath)}#webpage` });

    // 术语页：中文主译、原词与译名说明构成一个可独立解读的词条。
    const termPath = 'glossary/index.html';
    const term = blocks(termPath, 'head').flat().find((node) => node['@type'] === 'DefinedTerm' && node.termCode === 'идеальное')!;
    expect(term.url).toBe('https://ilyenkov.cn/glossary/#term/ilyenkov/ideal/');
    expect(term.termCode).toBe('идеальное');
    expect(term.inDefinedTermSet).toEqual({ '@type': 'DefinedTermSet', name: '术语库', url: 'https://ilyenkov.cn/glossary/' });

    // 书籍页：不把版次日期或复合责任者当作出版日期与单个人名。
    const book = entity('books/dialektika-abstraktnogo-i-konkretnogo/index.html', 'Book')!;
    expect(book.name).toBe(h1Of('books/dialektika-abstraktnogo-i-konkretnogo/index.html'));
    expect(book.datePublished).toBeUndefined();
    expect(book.author).toBeUndefined();
    expect(book.publisher).toBeUndefined();
    expect(book.translator).toBeUndefined();
    const editedBook = entity('books/molodoy-ilyenkov/index.html', 'Book')!;
    expect(editedBook.author).toBeUndefined();
    expect(editedBook.datePublished).toBeUndefined();
    expect(String(book.image)).toMatch(/^https:\/\/ilyenkov\.cn\/covers\//);

    // 人物页：生卒年、原文名与维基条目构成同一实体。
    const person = entity('ilyenkov/index.html', 'Person')!;
    expect(person.name).toBe(h1Of('ilyenkov/index.html'));
    expect(person.birthDate).toBe('1924');
    expect(person.deathDate).toBe('1979');
    expect(person.sameAs).toEqual([expect.stringContaining('zh.wikipedia.org')]);

    // 面包屑：有 <nav class="breadcrumbs"> 的页面在正文里给出同序的 BreadcrumbList。
    const withBreadcrumbs = indexable.filter((path) => read(path).includes('class="breadcrumbs"'));
    expect(withBreadcrumbs.length).toBeGreaterThan(0);
    for (const path of withBreadcrumbs) {
      const nodes = blocks(path, 'document')
        .flat()
        .filter((node) => node['@type'] === 'BreadcrumbList');
      expect(nodes, path).toHaveLength(1);
      const items = nodes[0]!.itemListElement as Array<Record<string, unknown>>;
      expect(items[0]!.name).toBe('首页');
      expect(items.map((item) => item.position)).toEqual(items.map((_, index) => index + 1));
      const last = items.at(-1)!;
      expect(last.item, path).toBe(canonicalOf(path));
      for (const item of items) expect(typeof item.name).toBe('string');
    }
  });
});
