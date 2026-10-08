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
    for (const path of pages()) {
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
    for (const path of pages().filter((path) => path !== '404.html')) {
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
    const expected = pages().filter((path) => path !== '404.html').map((path) => {
      // trailingSlash: 'always' —— 目录页在 sitemap 中同样带尾斜杠。
      const pathname = path === 'index.html' ? '/'
        : path.endsWith('/index.html') ? `/${path.slice(0, -'/index.html'.length)}/`
          : `/${path}`;
      return new URL(pathname, config.site).href;
    });
    expect(locations.toSorted()).toEqual(expected.toSorted());
    expect(new Set(locations).size).toBe(locations.length);
  });
});
