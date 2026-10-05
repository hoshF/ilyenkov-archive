import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readEditorialJson } from '../src/lib/editorial';
import {
  getUpdates,
  HOME_UPDATES_LIMIT,
  parseUpdates,
  UpdateSchema,
  UpdatesSchema,
  type Update,
} from '../src/lib/updates';

const builtPage = (route: string): string => readFileSync(
  path.join(process.cwd(), 'dist', route.replace(/^\//, ''), 'index.html'),
  'utf8',
);

function listItems(html: string): string[] {
  const list = html.match(/<ol class="updates-list">([\s\S]*?)<\/ol>/)?.[1] ?? '';
  return [...list.matchAll(/<li class="updates-list__item">([\s\S]*?)<\/li>/g)]
    .map(([, item]) => item);
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function expectItem(item: string, update: Update): void {
  expect(item).toContain(`datetime="${update.date}">${update.date}</time>`);
  // 摘要就是普通文本，不编译 Markdown 或插入 HTML。
  expect(item).toContain(`<p class="updates-list__text">${escapeText(update.summary)}</p>`);
  if (update.link) {
    expect(item).toContain(`href="${update.link.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`);
    expect(item).toContain(`>${escapeText(update.link_label ?? '查看相关内容')}</a>`);
  } else {
    expect(item).not.toContain('<a ');
  }
}

describe('public updates', () => {
  it('accepts a short plain-text update with optional related content', () => {
    expect(UpdateSchema.parse({ date: '2024-02-29', summary: '  整理资料。  ' }))
      .toEqual({ date: '2024-02-29', summary: '整理资料。' });
    for (const link of ['/', '/archive', '/group/0', '/archive?year=2026#list', 'https://example.org/source', 'http://example.org/']) {
      expect(UpdateSchema.safeParse({ date: '2026-10-05', summary: '公开变化。', link }).success, link)
        .toBe(true);
    }
    expect(UpdatesSchema.parse([])).toEqual([]);
  });

  it('rejects impossible dates, blank text, unsupported fields and labels without links', () => {
    for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '2026-10-00', '2026-1-05']) {
      expect(UpdateSchema.safeParse({ date, summary: '公开变化。' }).success, date).toBe(false);
    }
    for (const record of [
      { date: '2026-10-05', summary: ' ' },
      { date: '2026-10-05', summary: '公开变化。', link_label: '阅读说明' },
      { date: '2026-10-05', summary: '公开变化。', link: '/', link_label: ' ' },
      { date: '2026-10-05', summary: '公开变化。', body: '额外正文' },
    ]) {
      expect(UpdateSchema.safeParse(record).success).toBe(false);
    }
  });

  it('rejects script, filesystem, relative and protocol-relative links', () => {
    for (const link of [
      'javascript:alert(1)', 'data:text/html,test', 'file:///private/example.md',
      'archive', '//example.org/', '/\\example.org/', '/archive\n/path',
      'https:example.org', 'https://example.org/with space', 'https://user:password@example.org/',
    ]) {
      expect(UpdateSchema.safeParse({ date: '2026-10-05', summary: '公开变化。', link }).success, link)
        .toBe(false);
    }
  });

  it('loads only editorial updates and orders dates descending with stable same-day order', () => {
    const older = { date: '2026-10-01', summary: '较早的变化。' };
    const sameDayFirst = { date: '2026-10-05', summary: '同日第一项。' };
    const sameDaySecond = { date: '2026-10-05', summary: '同日第二项。' };
    const unordered = [older, sameDayFirst, sameDaySecond];
    expect(parseUpdates(unordered)).toEqual([sameDayFirst, sameDaySecond, older]);
    expect(unordered).toEqual([older, sameDayFirst, sameDaySecond]);

    const source = UpdatesSchema.parse(readEditorialJson('updates.json'));
    const expected = [...source].sort((left, right) => right.date.localeCompare(left.date));
    const updates = getUpdates();
    expect(updates).toEqual(expected);
    for (const date of new Set(source.map((update) => update.date))) {
      expect(updates.filter((update) => update.date === date))
        .toEqual(source.filter((update) => update.date === date));
    }
  });

  it('renders the complete stream and the same recent prefix on the homepage', () => {
    const updates = getUpdates();
    const complete = builtPage('/updates');
    const home = builtPage('/');
    const completeItems = listItems(complete);
    const homeItems = listItems(home);

    expect(completeItems).toHaveLength(updates.length);
    expect(homeItems).toHaveLength(Math.min(HOME_UPDATES_LIMIT, updates.length));
    expect(homeItems).toEqual(completeItems.slice(0, HOME_UPDATES_LIMIT));
    updates.forEach((update, index) => expectItem(completeItems[index], update));
    // 首页动态可链接相关内容，但不应带读者回到正在阅读的首页。
    for (const item of homeItems) {
      const hrefs = [...item.matchAll(/href="([^"]+)"/g)].map(([, href]) => href);
      for (const href of hrefs) {
        if (!href.startsWith('/')) continue;
        expect(new URL(href, 'https://example.org').pathname, href).not.toBe('/');
      }
    }

    expect(complete).toContain('<h1 class="page-title">近期动态</h1>');
    expect(home).toContain('href="/updates/">查看全部动态</a>');
    for (const html of [home, complete]) {
      expect(html).not.toContain('<script');
    }
  });

  it('points every internal update link at a generated public page', () => {
    for (const update of getUpdates()) {
      if (!update.link?.startsWith('/')) continue;
      const pathname = new URL(update.link, 'https://example.org').pathname;
      const file = path.join(process.cwd(), 'dist', pathname.replace(/^\//, ''), 'index.html');
      expect(existsSync(file), update.link).toBe(true);
    }
  });
});
